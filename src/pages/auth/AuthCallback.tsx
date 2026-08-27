import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function AuthCallback() {
  const navigate = useNavigate()
  const processedRef = useRef(false)

  useEffect(() => {
    // Prevent React StrictMode from executing duplicate PKCE code exchanges
    if (processedRef.current) return
    processedRef.current = true

    let mounted = true

    const handleAuthCallback = async () => {
      try {
        const url = new URL(window.location.href)

        // 1. Check for provider error in query string or hash fragment
        const searchParams = url.searchParams
        const hashParams = new URLSearchParams(
          url.hash.startsWith('#') ? url.hash.substring(1) : url.hash
        )

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

        // 2. Check for PKCE authorization code
        const code = searchParams.get('code')

        let user: User | null = null

        // Check if session already exists
        const { data: initialSessionData } = await supabase.auth.getSession()
        if (initialSessionData?.session?.user) {
          user = initialSessionData.session.user
        }

        // If code is present and no active user yet, exchange code for session
        if (!user && code) {
          try {
            const { data: exchangeData, error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(code)

            if (!exchangeError && exchangeData?.user) {
              user = exchangeData.user
            } else if (exchangeError) {
              console.warn(
                'Direct code exchange note (checking if auto-detected):',
                exchangeError.message
              )
              // If client auto-detected or already exchanged, verify session
              const { data: fallbackSession } = await supabase.auth.getSession()
              if (fallbackSession?.session?.user) {
                user = fallbackSession.session.user
              }
            }
          } catch (exchangeEx) {
            console.warn('Code exchange exception, checking session:', exchangeEx)
            const { data: fallbackSession } = await supabase.auth.getSession()
            if (fallbackSession?.session?.user) {
              user = fallbackSession.session.user
            }
          }
        }

        // 3. If user is still not resolved, wait for onAuthStateChange
        if (!user) {
          user = await new Promise<User | null>((resolve) => {
            let resolved = false

            // Check getSession one more time
            supabase.auth.getSession().then(({ data }) => {
              if (data?.session?.user && !resolved) {
                resolved = true
                resolve(data.session.user)
              }
            })

            const {
              data: { subscription },
            } = supabase.auth.onAuthStateChange((event, session) => {
              if (
                session?.user &&
                !resolved &&
                (event === 'SIGNED_IN' ||
                  event === 'INITIAL_SESSION' ||
                  event === 'TOKEN_REFRESHED')
              ) {
                resolved = true
                subscription.unsubscribe()
                resolve(session.user)
              }
            })

            // Safety timeout after 5 seconds
            setTimeout(() => {
              if (!resolved) {
                resolved = true
                subscription.unsubscribe()
                supabase.auth.getUser().then(({ data }) => {
                  resolve(data?.user || null)
                })
              }
            }, 5000)
          })
        }

        if (!mounted) return

        // 4. If no user could be verified after all attempts, route to login
        if (!user) {
          console.error('Authentication user could not be established')
          navigate('/login', {
            replace: true,
            state: {
              error: 'Authentication failed. Please try signing in again.',
            },
          })
          return
        }

        // Clean OAuth query parameters from browser history
        window.history.replaceState({}, document.title, window.location.pathname)

        // 5. Check user profile / username
        let hasUsername = false

        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle()

          if (!profileError && profile?.username) {
            hasUsername = true
          } else if (user.user_metadata?.username) {
            hasUsername = true
          }
        } catch (profileErr) {
          console.warn('Profile check fallback:', profileErr)
          if (user.user_metadata?.username) {
            hasUsername = true
          }
        }

        if (!mounted) return

        // 6. Route based on profile status
        if (!hasUsername) {
          console.log('Username onboarding required for user:', user.id)
          navigate('/choose-username', { replace: true })
        } else {
          console.log('Existing user verified. Entering dashboard:', user.email)
          navigate('/dashboard', { replace: true })
        }
      } catch (error) {
        console.error('Unexpected error in AuthCallback:', error)
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
      <div className="w-full max-w-sm bg-white border-4 border-black shadow-[8px_8px_0_#ffd43b] p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-5 bg-[#ffd43b] border-3 border-black shadow-[4px_4px_0_#000000] flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-black animate-spin" />
        </div>

        <div className="inline-block bg-[#38aef0] border-2 border-black px-2.5 py-0.5 text-[10px] font-mono font-black uppercase mb-3 shadow-[2px_2px_0_#000000]">
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