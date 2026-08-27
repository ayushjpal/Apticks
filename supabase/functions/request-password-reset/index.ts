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
    const { identifier } = await req.json()

    if (!identifier || !String(identifier).trim()) {
      return new Response(
        JSON.stringify({ error: 'Please provide your username or email address.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cleanInput = String(identifier).trim().toLowerCase()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

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

    let targetEmail: string | null = null
    let hasUnverifiedEmail = false

    if (cleanInput.includes('@')) {
      // Input is direct email address - only process if not internal domain
      if (!cleanInput.endsWith('@apticks.app') && !cleanInput.endsWith('@auth.apticks.internal') && !cleanInput.endsWith('@aptiverse.local')) {
        targetEmail = cleanInput
      }
    } else {
      // Input is username - resolve to profile and auth user
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, username')
        .ilike('username', cleanInput)
        .maybeSingle()

      if (profile && profile.id) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(profile.id)
        const userEmail = userData?.user?.email
        const isInternal = !userEmail || userEmail.endsWith('@apticks.app') || userEmail.endsWith('@auth.apticks.internal') || userEmail.endsWith('@aptiverse.local')

        if (userEmail && !isInternal && userData.user.email_confirmed_at) {
          targetEmail = userEmail
        } else if (isInternal || !userData?.user?.email_confirmed_at) {
          hasUnverifiedEmail = true
        }
      }
    }

    if (hasUnverifiedEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          unverified: true,
          message: 'Add and verify an email from your Profile to enable account recovery.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If targetEmail is valid, trigger password reset
    if (targetEmail) {
      const origin = req.headers.get('origin') || ''
      await supabaseAdmin.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${origin}/update-password`,
      })
    }

    // Return generic safe response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with a verified email, a password reset link has been sent.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch {
    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with a verified email, a password reset link has been sent.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
