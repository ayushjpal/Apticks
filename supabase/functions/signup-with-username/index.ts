import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Canonical username validation regex
const CANONICAL_USERNAME_REGEX = /^[a-z0-9][a-z0-9_.-]*[a-z0-9]$/
const CONSECUTIVE_SEPARATORS_REGEX = /[._-]{2,}/

function validateUsernameRules(username: string): { isValid: boolean; message: string } {
  if (!username) {
    return { isValid: false, message: 'Username cannot be empty.' }
  }
  if (username.length < 3) {
    return { isValid: false, message: 'Username must be at least 3 characters.' }
  }
  if (username.length > 20) {
    return { isValid: false, message: 'Username cannot exceed 20 characters.' }
  }
  if (!CANONICAL_USERNAME_REGEX.test(username)) {
    return {
      isValid: false,
      message: 'Username can only contain lowercase letters, numbers, periods, underscores, and hyphens, and cannot start or end with a separator.',
    }
  }
  if (CONSECUTIVE_SEPARATORS_REGEX.test(username)) {
    return {
      isValid: false,
      message: 'Username cannot contain consecutive separators (e.g. "..", "__", "--").',
    }
  }
  return { isValid: true, message: 'Valid' }
}

function validatePasswordStrength(password: string): { isValid: boolean; message: string } {
  if (!password || password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' }
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter (A-Z).' }
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter (a-z).' }
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number (0-9).' }
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character.' }
  }
  return { isValid: true, message: 'Valid' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Username and password are required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cleanUsername = String(username).trim().toLowerCase()

    // 1. Validate Username
    const usernameValidation = validateUsernameRules(cleanUsername)
    if (!usernameValidation.isValid) {
      return new Response(
        JSON.stringify({ error: usernameValidation.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Validate Password
    const passwordValidation = validatePasswordStrength(String(password))
    if (!passwordValidation.isValid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 3. Check for existing username in public.profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .ilike('username', cleanUsername)
      .maybeSingle()

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: `Username @${cleanUsername} is already taken. Please choose another.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Create internal Auth User record with RFC-compliant Apticks system domain
    const systemIdentifier = `u_${cleanUsername}@apticks.app`

    const { data: createdUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: systemIdentifier,
      password: String(password),
      email_confirm: true,
      user_metadata: {
        username: cleanUsername,
        display_name: cleanUsername,
      },
    })

    if (createUserError || !createdUserData?.user) {
      console.error('Admin createUser error:', createUserError)
      return new Response(
        JSON.stringify({ error: createUserError?.message || 'Failed to create user account.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const newUserId = createdUserData.user.id

    // 5. Ensure profile is upserted in public.profiles
    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        username: cleanUsername,
        display_name: cleanUsername,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (profileUpsertError) {
      console.error('Profile upsert error in signup:', profileUpsertError)
      // Rollback auth user creation if profile fails
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      return new Response(
        JSON.stringify({ error: 'Failed to create profile. Username may already be in use.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6. Authenticate and retrieve session tokens for client
    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: authData, error: authError } = await supabaseAuthClient.auth.signInWithPassword({
      email: systemIdentifier,
      password: String(password),
    })

    if (authError || !authData?.session) {
      console.error('Initial login error after creation:', authError)
      return new Response(
        JSON.stringify({ error: 'Account created, but initial session establishment failed. Please log in.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user,
        profile: {
          id: newUserId,
          username: cleanUsername,
          display_name: cleanUsername,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    console.error('Unexpected error in signup-with-username:', err)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred during signup.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
