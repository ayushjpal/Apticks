import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, User, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { normalizeUsername } from '../../utils/validation'
import AuthBackground from '../../components/auth/AuthBackground'
import AuthInput from '../../components/auth/AuthInput'
import AuthPrimaryButton from '../../components/auth/AuthPrimaryButton'
import AuthSocialButton from '../../components/auth/AuthSocialButton'
import AuthAlert from '../../components/auth/AuthAlert'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  // Form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)

  // Messages
  const [error, setError] = useState<string>(
    (location.state as { error?: string })?.error || ''
  )
  const [infoMessage] = useState<string>(
    (location.state as { message?: string })?.message || ''
  )

  // -----------------------------
  // Username & Password Login
  // -----------------------------
  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const cleanUsername = normalizeUsername(username)

    if (!cleanUsername) {
      setError('Please enter your username.')
      return
    }

    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)

    try {
      let sessionEstablished = false

      // 1. Invoke server-side login Edge Function
      try {
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          'login-with-username',
          {
            body: {
              username: cleanUsername,
              password,
            },
          }
        )

        if (!fnError && fnData?.session) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: fnData.session.access_token,
            refresh_token: fnData.session.refresh_token,
          })

          if (!sessionError) {
            sessionEstablished = true
          }
        } else if (fnData?.error && !fnError) {
          setError(fnData.error)
          return
        }
      } catch (fnErr) {
        console.warn('Edge Function fallback trigger:', fnErr)
      }

      // 2. Direct client fallback if Edge Function is not active
      if (!sessionEstablished) {
        const systemIdentifier = `u_${cleanUsername}@apticks.app`

        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: systemIdentifier,
            password,
          })

        if (signInError) {
          console.error('Sign-in error:', signInError)
          setError(signInError.message || 'Invalid username or password.')
          return
        }

        if (signInData.session) {
          sessionEstablished = true
        }
      }

      if (!sessionEstablished) {
        setError('Unable to authenticate. Please check your credentials.')
        return
      }

      // 3. Verify user profile exists
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('Authentication session lost. Please try again.')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile || !profile.username) {
        navigate('/choose-username', { replace: true })
        return
      }

      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.'
      console.error('Login error:', err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // -----------------------------
  // Google OAuth Login
  // -----------------------------
  const handleGoogleLogin = async () => {
    setError('')
    setOauthLoading('google')

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (oauthError) {
        console.error('Google OAuth error:', oauthError)
        setError(oauthError.message)
        setOauthLoading(null)
      }
    } catch (err) {
      console.error('Google login exception:', err)
      setError('Unable to connect to Google. Please try again.')
      setOauthLoading(null)
    }
  }

  // -----------------------------
  // GitHub OAuth Login
  // -----------------------------
  const handleGithubLogin = async () => {
    setError('')
    setOauthLoading('github')

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (oauthError) {
        console.error('GitHub OAuth error:', oauthError)
        setError(oauthError.message)
        setOauthLoading(null)
      }
    } catch (err) {
      console.error('GitHub login exception:', err)
      setError('Unable to connect to GitHub. Please try again.')
      setOauthLoading(null)
    }
  }

  return (
    <AuthBackground
      variant="login"
      navRight={
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
          <span className="hidden sm:inline">New here?</span>
          <Link
            to="/signup"
            className="font-display font-semibold text-[#ffd43b] hover:text-[#facc15] transition-colors inline-flex items-center gap-1"
          >
            <span>Create an account</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      }
      editorialBottomLeft={
        <>
          SAME<br />
          PLAYGROUND.<br />
          HIGHER YOU.
        </>
      }
      editorialBottomRight={
        <>
          DISCIPLINE<br />
          BUILDS<br />
          FREEDOM.
        </>
      }
    >
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* ======================================================= */}
        {/* LEFT EDITORIAL SECTION                                  */}
        {/* ======================================================= */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="font-mono text-xs sm:text-sm tracking-[0.25em] text-[#ffd43b]/90 font-bold uppercase mb-3">
            01
          </div>
          <div className="w-12 sm:w-16 h-px bg-slate-700/80 mb-6 sm:mb-8" />
          <h1 className="font-display font-extrabold text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-[1.05]">
            Welcome<br />
            <span className="text-[#ffd43b]">Back.</span>
          </h1>
          <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
            <p className="font-display text-base sm:text-lg font-semibold text-slate-200">
              Enter the arena again.
            </p>
            <div className="font-sans text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm space-y-1">
              <p>Consistent practice.</p>
              <p>Faster thinking.</p>
              <p>A higher you.</p>
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* RIGHT AUTHENTICATION CARD                               */}
        {/* ======================================================= */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-[440px] bg-[#0c1d2d] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Subtle Top Yellow Accent */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#ffd43b]/40 to-transparent" />

            {/* Heading Section */}
            <div className="mb-6">
              <h2 className="font-display font-bold text-2xl text-white tracking-tight">
                Sign In
              </h2>
              <p className="font-sans text-xs text-slate-400 mt-1">
                Enter your username and password to continue.
              </p>
            </div>

            {/* Info Alert */}
            {infoMessage && <AuthAlert type="info" message={infoMessage} className="mb-4" />}

            {/* Error Alert */}
            {error && <AuthAlert type="error" message={error} className="mb-4" />}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Username field */}
              <AuthInput
                id="username"
                label="USERNAME"
                icon={<User className="w-3.5 h-3.5" />}
                prefixText="@"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />

              {/* Password field */}
              <AuthInput
                id="password"
                label="PASSWORD"
                labelRight={
                  <Link
                    to="/forgot-password"
                    className="font-mono text-xs text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                }
                type={showPassword ? 'text' : 'password'}
                icon={<Lock className="w-3.5 h-3.5" />}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                action={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              {/* Primary Submit CTA */}
              <div className="pt-2">
                <AuthPrimaryButton
                  type="submit"
                  disabled={loading || oauthLoading !== null}
                  loading={loading}
                  loadingText="Signing in..."
                >
                  Sign In
                </AuthPrimaryButton>
              </div>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                OR CONTINUE WITH
              </span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Two Compact Social Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <AuthSocialButton
                provider="google"
                compact
                onClick={handleGoogleLogin}
                loading={oauthLoading === 'google'}
                disabled={loading || oauthLoading !== null}
              />
              <AuthSocialButton
                provider="github"
                compact
                onClick={handleGithubLogin}
                loading={oauthLoading === 'github'}
                disabled={loading || oauthLoading !== null}
              />
            </div>
          </div>
        </div>
      </div>
    </AuthBackground>
  )
}