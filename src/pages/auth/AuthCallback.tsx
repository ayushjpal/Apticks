import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../../lib/supabase'


function AuthCallback() {
  const navigate = useNavigate()


  useEffect(() => {

    let mounted = true


    const handleAuthCallback = async () => {

      try {

        // -----------------------------------------
        // Read OAuth response from URL
        // -----------------------------------------

        const url = new URL(window.location.href)

        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')
        const errorDescription =
          url.searchParams.get('error_description')


        // -----------------------------------------
        // OAuth provider returned an error
        // -----------------------------------------

        if (error) {

          console.error(
            'OAuth provider error:',
            error,
            errorDescription
          )

          if (mounted) {

            navigate('/login', {
              replace: true,
              state: {
                error:
                  errorDescription ||
                  'Authentication failed. Please try again.',
              },
            })

          }

          return
        }


        // -----------------------------------------
        // Exchange OAuth code for Supabase session
        // -----------------------------------------

        if (code) {

          const {
            error: exchangeError,
          } = await supabase.auth.exchangeCodeForSession(
            code
          )


          if (exchangeError) {

            console.error(
              'OAuth code exchange error:',
              exchangeError
            )

            if (mounted) {

              navigate('/login', {
                replace: true,
                state: {
                  error:
                    'Could not complete authentication. Please try again.',
                },
              })

            }

            return
          }
        }


        // -----------------------------------------
        // Get authenticated user
        // -----------------------------------------

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()


        if (userError || !user) {

          console.error(
            'Authentication user error:',
            userError
          )

          if (mounted) {

            navigate('/login', {
              replace: true,
              state: {
                error:
                  'Authentication failed. Please try again.',
              },
            })

          }

          return
        }


        // -----------------------------------------
        // Check user's profile
        // -----------------------------------------

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()


        if (profileError) {

          console.error(
            'Profile lookup error:',
            profileError
          )

          if (mounted) {

            navigate('/login', {
              replace: true,
              state: {
                error:
                  'Unable to load your profile. Please try again.',
              },
            })

          }

          return
        }


        // -----------------------------------------
        // Remove OAuth query parameters
        // -----------------------------------------

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        )


        // -----------------------------------------
        // No profile OR username missing
        // → Choose Username
        // -----------------------------------------

        if (
          !profile ||
          !profile.username
        ) {

          console.log(
            'Username missing. Redirecting to Choose Username.'
          )

          if (mounted) {

            navigate('/choose-username', {
              replace: true,
            })

          }

          return
        }


        // -----------------------------------------
        // Existing user
        // → Dashboard
        // -----------------------------------------

        console.log(
          'Authentication successful:',
          user.email
        )


        if (mounted) {

          navigate('/dashboard', {
            replace: true,
          })

        }

      } catch (error) {

        console.error(
          'Unexpected authentication callback error:',
          error
        )

        if (mounted) {

          navigate('/login', {
            replace: true,
            state: {
              error:
                'Something went wrong during authentication. Please try again.',
            },
          })

        }

      }

    }


    handleAuthCallback()


    // -----------------------------------------
    // Cleanup
    // -----------------------------------------

    return () => {
      mounted = false
    }

  }, [navigate])


  // -----------------------------------------
  // Loading UI
  // -----------------------------------------

  return (

    <div className="min-h-screen flex items-center justify-center bg-[#071a2b] text-white">

      <div className="text-center">

        <div
          className="
            mx-auto
            mb-6
            h-12
            w-12
            border-4
            border-white/20
            border-t-[#60a5fa]
            rounded-full
            animate-spin
          "
        />

        <h1 className="text-3xl font-black">
          SIGNING YOU IN...
        </h1>

        <p className="mt-3 text-white/60">
          Please wait while we finish authentication.
        </p>

      </div>

    </div>
  )
}


export default AuthCallback