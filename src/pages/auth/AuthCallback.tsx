import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true

    const handleAuthCallback = async () => {
      try {
        const url = new URL(window.location.href)

        // 1. Check for OAuth errors in search params or hash fragment
        const searchParams = url.searchParams
        const rawHash = window.location.hash.startsWith('#')
          ? window.location.hash.substring(1)
          : window.location.hash
        const hashParams = new URLSearchParams(rawHash)

        const error = searchParams.get('error') || hashParams.get('error')
        const errorDescription =
          searchParams.get('error_description') || hashParams.get('error_description')

        if (error) {
          console.error('OAuth provider error:', error, errorDescription)
          if (mounted) {
            navigate('/login', {
              replace: true,
              state: {
                error: errorDescription || 'Authentication failed. Please try again.',
              },
            })
          }
          return
        }

        // 2. Handle Implicit Flow (hash contains access_token & refresh_token)
        const hashAccessToken = hashParams.get('access_token')
        const hashRefreshToken = hashParams.get('refresh_token')

        if (hashAccessToken && hashRefreshToken) {
          try {
            await supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: hashRefreshToken,
            })
          } catch (setSessionErr) {
            console.warn('Manual setSession note:', setSessionErr)
          }
        }

        // 3. Handle PKCE Flow (search params contain code)
        const code = searchParams.get('code')
        if (code) {
          try {
            await supabase.auth.exchangeCodeForSession(code)
          } catch (exchangeErr) {
            console.warn('exchangeCodeForSession note:', exchangeErr)
          }
        }

        // 4. Resolve authenticated user from session
        let user = (await supabase.auth.getSession()).data?.session?.user || null

        // If session not yet in storage, check getUser() directly
        if (!user) {
          const { data: userData } = await supabase.auth.getUser()
          user = userData?.user || null
        }

        // If still pending, wait briefly for onAuthStateChange
        if (!user) {
          user = await new Promise((resolve) => {
            let done = false

            const {
              data: { subscription },
            } = supabase.auth.onAuthStateChange((_event, session) => {
              if (session?.user && !done) {
                done = true
                subscription.unsubscribe()
                resolve(session.user)
              }
            })

            // Short timeout fallback
            setTimeout(async () => {
              if (!done) {
                done = true
                subscription.unsubscribe()
                const { data: finalUserData } = await supabase.auth.getUser()
                resolve(finalUserData?.user || null)
              }
            }, 2000)
          })
        }

        if (!mounted) return

        // 5. If no user resolved, route to login
        if (!user) {
          console.error('No authenticated session established in callback')
          navigate('/login', {
            replace: true,
            state: {
              error: 'Authentication session could not be established. Please try again.',
            },
          })
          return
        }

        // 6. Clean OAuth query and hash parameters from URL bar
        window.history.replaceState({}, document.title, window.location.pathname)

        // 7. Check if user already has an Apticks profile / username
        let hasUsername = false

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle()

          if (profile?.username) {
            hasUsername = true
          } else if (user.user_metadata?.username) {
            hasUsername = true
          }
        } catch (profileErr) {
          console.warn('Profile lookup note in callback:', profileErr)
          if (user.user_metadata?.username) {
            hasUsername = true
          }
        }

        if (!mounted) return

        // 8. Destination Routing: Existing user -> /dashboard, New user -> /choose-username
        if (hasUsername) {
          navigate('/dashboard', { replace: true })
        } else {
          navigate('/choose-username', { replace: true })
        }
      } catch (err) {
        console.error('Unexpected error in AuthCallback:', err)
        if (mounted) {
          navigate('/login', {
            replace: true,
            state: {
              error: 'Something went wrong during authentication. Please try again.',
            },
          })
        }
      }
    }

    handleAuthCallback()

    return () => {
      mounted = false
    }
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#071a2b] text-black px-4 arena-bg-grid">
      <div className="w-full max-w-sm bg-white border-4 border-[#0c1d2d] shadow-[8px_8px_0_#ffd43b] p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-5 bg-[#ffd43b] border-3 border-[#0c1d2d] shadow-[3px_3px_0_#0c1d2d] flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-black animate-spin" />
        </div>

        <div className="inline-block bg-[#38aef0] border-2 border-[#0c1d2d] px-2.5 py-0.5 text-[10px] font-mono font-black uppercase mb-3 shadow-[2px_2px_0_#0c1d2d]">
          AUTHENTICATING
        </div>

        <h1 className="font-display font-black text-2xl uppercase tracking-tight text-black">
          ENTERING ARENA...
        </h1>

        <p className="mt-2 text-xs font-body font-semibold text-black/70">
          Verifying session credentials and loading your Apticks profile.
        </p>
      </div>
    </div>
  )
}