import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, User, Lock, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { normalizeUsername } from '../../utils/validation'
import AuthShell from '../../components/auth/AuthShell'

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
    <AuthShell
      eyebrow="Apticks Account"
      title="Sign In"
      subtitle="Enter your username and password to continue to the arena."
    >
      {/* Info notification */}
      {infoMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium shadow-xs">
          {infoMessage}
        </div>
      )}

      {/* Error notification */}
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium shadow-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        {/* Username input */}
        <div>
          <label
            htmlFor="username"
            className="block mb-1 text-xs font-semibold text-slate-700 uppercase tracking-wider"
          >
            Username
          </label>
          <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden transition-all">
            <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-slate-500 font-semibold text-xs flex items-center">
              <User className="w-4 h-4 mr-1 text-slate-400" />
              @
            </span>
            <input
              id="username"
              type="text"
              placeholder="e.g. speed_solver"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              className="w-full py-2.5 px-3 outline-none font-medium text-sm bg-transparent placeholder:text-slate-400 text-slate-900"
            />
          </div>
        </div>

        {/* Password input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden transition-all">
            <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-slate-400 flex items-center">
              <Lock className="w-4 h-4" />
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full py-2.5 px-3 outline-none font-medium text-sm bg-transparent placeholder:text-slate-400 text-slate-900"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="px-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading || oauthLoading !== null}
          className="w-full py-2.5 sm:py-3 bg-[#ffd43b] hover:bg-[#fcc419] text-[#0c1d2d] rounded-xl font-semibold text-sm shadow-xs transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>{loading ? 'Signing in...' : 'Sign In to Arena'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Or Continue With
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || oauthLoading !== null}
          className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-700 transition-colors shadow-2xs cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M21.35 12.27c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.44h3.14c1.84-1.69 2.91-4.18 2.91-7.21z"
              />
              <path
                fill="#34A853"
                d="M12 21.82c2.63 0 4.84-.87 6.45-2.35l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.55 0-4.72-1.72-5.5-4.04H3.25v2.52A9.74 9.74 0 0 0 12 21.82z"
              />
              <path
                fill="#FBBC05"
                d="M6.5 13.91A5.86 5.86 0 0 1 6.2 12c0-.66.11-1.3.3-1.91V7.57H3.25A9.82 9.82 0 0 0 2.18 12c0 1.59.38 3.09 1.07 4.43L6.5 13.91z"
              />
              <path
                fill="#EA4335"
                d="M12 6.05c1.43 0 2.72.49 3.74 1.46l2.8-2.8C16.84 3.15 14.63 2.18 12 2.18a9.74 9.74 0 0 0-8.75 5.39L6.5 10.09C7.28 7.77 9.45 6.05 12 6.05z"
              />
            </svg>
            <span>{oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={handleGithubLogin}
          disabled={loading || oauthLoading !== null}
          className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-700 transition-colors shadow-2xs cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 shrink-0 text-slate-900 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.25c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.76.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5z" />
            </svg>
            <span>{oauthLoading === 'github' ? 'Connecting...' : 'Continue with GitHub'}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Switch to Signup */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          New to Apticks?
        </span>
        <Link
          to="/signup"
          className="text-xs font-semibold text-slate-800 hover:text-sky-600 transition-colors"
        >
          Create an account →
        </Link>
      </div>
    </AuthShell>
  )
}