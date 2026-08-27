import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Admin client for secure server-side username -> identity lookup
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 1. Look up user by canonical username in public.profiles
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .ilike('username', cleanUsername)
      .maybeSingle()

    let targetEmail: string | null = null

    if (profile && profile.id) {
      // Fetch user from auth.users securely
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id)
      if (!userError && userData?.user?.email) {
        targetEmail = userData.user.email
      }
    }

    // If no target email or user not found, reject with generic invalid credentials
    if (!targetEmail) {
      return new Response(
        JSON.stringify({ error: 'Invalid username or password.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Perform authentication with Supabase Auth
    // Use client initialized with anon key to authenticate and receive session tokens
    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: authData, error: authError } = await supabaseAuthClient.auth.signInWithPassword({
      email: targetEmail,
      password: String(password),
    })

    if (authError || !authData?.session) {
      return new Response(
        JSON.stringify({ error: 'Invalid username or password.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return the authenticated session and user payload
    return new Response(
      JSON.stringify({
        session: authData.session,
        user: authData.user,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid username or password.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
