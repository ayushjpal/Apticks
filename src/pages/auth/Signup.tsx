import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight, User, Lock, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ProfileService, type UsernameValidationResult } from '../../services/profileService'
import { validatePassword, normalizeUsername } from '../../utils/validation'
import AuthShell from '../../components/auth/AuthShell'

export default function Signup() {
  const navigate = useNavigate()

  // Form state
  const [username, setUsername] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)

  // Live username availability check state
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<UsernameValidationResult | null>(null)

  // Messages
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // -----------------------------
  // Debounced Live Username Check
  // -----------------------------
  useEffect(() => {
    const clean = normalizeUsername(username)

    if (!clean) {
      return
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true)
      const result = await ProfileService.validateAndCheckUsername(clean)
      setUsernameStatus(result)
      setCheckingUsername(false)
    }, 350)

    return () => {
      clearTimeout(timer)
    }
  }, [username])

  // -----------------------------
  // Username & Password Signup
  // -----------------------------
  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const cleanUsername = normalizeUsername(username)

    if (!cleanUsername) {
      setError('Please choose a username.')
      return
    }

    const checkResult = await ProfileService.validateAndCheckUsername(cleanUsername)
    if (!checkResult.isValid) {
      setError(checkResult.message)
      return
    }

    if (!checkResult.isAvailable) {
      setError(`Username @${cleanUsername} is already taken. Please choose another.`)
      return
    }

    if (!confirmPassword) {
      setError('Please enter a password.')
      return
    }

    const passwordValidation = validatePassword(confirmPassword)
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message)
      return
    }

    setLoading(true)

    try {
      let sessionEstablished = false

      // 1. Call secure server-side signup Edge Function
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke(
          'signup-with-username',
          {
            body: {
              username: cleanUsername,
              password: confirmPassword,
            },
          }
        )

        if (!fnError && result?.session) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          })

          if (!sessionError) {
            sessionEstablished = true
          }
        } else if (result?.error && !fnError) {
          setError(result.error)
          return
        }
      } catch (fnErr) {
        console.warn('Edge Function fallback trigger:', fnErr)
      }

      // 2. Direct client fallback
      if (!sessionEstablished) {
        const systemIdentifier = `u_${cleanUsername}@apticks.app`

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: systemIdentifier,
          password: confirmPassword,
          options: {
            data: {
              username: cleanUsername,
              display_name: cleanUsername,
            },
          },
        })

        if (signUpError) {
          console.error('Signup error:', signUpError)
          setError(signUpError.message || 'Unable to create account. Please try again.')
          return
        }

        if (signUpData.user) {
          await supabase.from('profiles').upsert({
            id: signUpData.user.id,
            username: cleanUsername,
            display_name: cleanUsername,
            updated_at: new Date().toISOString(),
          })

          if (signUpData.session) {
            sessionEstablished = true
          } else {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: systemIdentifier,
              password: confirmPassword,
            })

            if (!signInError && signInData.session) {
              sessionEstablished = true
            }
          }
        }
      }

      if (!sessionEstablished) {
        setError('Account created. Please proceed to sign in.')
        navigate('/login', { replace: true })
        return
      }

      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      console.error('Unexpected signup error:', err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  // -----------------------------
  // Google / GitHub Signup
  // -----------------------------
  const handleGoogleSignup = async () => {
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
      console.error('Google signup exception:', err)
      setError('Unable to continue with Google. Please try again.')
      setOauthLoading(null)
    }
  }

  const handleGithubSignup = async () => {
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
      console.error('GitHub signup exception:', err)
      setError('Unable to continue with GitHub. Please try again.')
      setOauthLoading(null)
    }
  }

  return (
    <AuthShell
      eyebrow="Join Apticks"
      title="Create Account"
      subtitle="Create your username and start competing in the arena."
    >
      {/* Error notification */}
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Success notification */}
      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        {/* Username */}
        <div>
          <label
            htmlFor="signup-username"
            className="block mb-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase"
          >
            Choose Username
          </label>
          <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden transition-all">
            <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-slate-500 font-semibold text-xs flex items-center">
              <User className="w-3.5 h-3.5 text-slate-400 mr-1" />
              @
            </span>
            <input
              id="signup-username"
              type="text"
              placeholder="e.g. speed_solver"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (!e.target.value.trim()) {
                  setUsernameStatus(null)
                }
              }}
              maxLength={20}
              autoComplete="username"
              autoFocus
              className="w-full py-2.5 px-3 outline-none font-medium text-sm bg-transparent placeholder:text-slate-400 text-slate-900"
            />
          </div>

          {/* Real-time username feedback pill */}
          {username.trim() && (
            <div className="mt-2">
              {checkingUsername ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-medium text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>Checking handle availability...</span>
                </div>
              ) : usernameStatus ? (
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg font-medium text-xs ${
                    !usernameStatus.isValid
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : usernameStatus.isAvailable
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {!usernameStatus.isValid ? (
                    <>
                      <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{usernameStatus.message}</span>
                    </>
                  ) : usernameStatus.isAvailable ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span>Handle is available!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>Username is taken</span>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <p className="mt-1.5 text-[11px] text-slate-500 font-medium">
            3–20 characters • letters, numbers, _, -, .
          </p>
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="signup-confirm-password"
            className="block mb-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase"
          >
            Password
          </label>
          <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden transition-all">
            <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-slate-400 flex items-center">
              <Lock className="w-4 h-4 text-slate-400" />
            </span>
            <input
              id="signup-confirm-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create your secure password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
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
          <p className="mt-1.5 text-[11px] text-slate-500 font-medium">
            Min 8 chars with uppercase, lowercase, number & special char
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || oauthLoading !== null || checkingUsername}
          className="w-full py-2.5 sm:py-3 bg-[#ffd43b] hover:bg-[#fcc419] text-[#0c1d2d] border border-amber-400/60 rounded-xl font-semibold text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
        >
          <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Or sign up with
        </span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading || oauthLoading !== null}
          className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-700 shadow-2xs transition-colors cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
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
          onClick={handleGithubSignup}
          disabled={loading || oauthLoading !== null}
          className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-700 shadow-2xs transition-colors cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 shrink-0 text-slate-900 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.25c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.76.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5z" />
            </svg>
            <span>{oauthLoading === 'github' ? 'Connecting...' : 'Continue with GitHub'}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Switch to Login */}
      <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Already on Apticks?
        </span>
        <Link
          to="/login"
          className="text-xs font-semibold text-[#0c1d2d] hover:text-blue-600 transition-colors flex items-center gap-1"
        >
          Sign in →
        </Link>
      </div>
    </AuthShell>
  )
}