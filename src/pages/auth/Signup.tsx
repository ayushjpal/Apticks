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
      eyebrow="JOIN APTICKS"
      title="CREATE ACCOUNT"
      subtitle="Create your username and start competing in the arena."
    >
      {/* Error notification */}
      {error && (
        <div className="mb-4 p-3 bg-[#fee2e2] border-2 border-[#0c1d2d] rounded-xl text-[#991b1b] font-display font-black text-xs shadow-[2.5px_2.5px_0_#000000] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#991b1b]" />
          <span>{error}</span>
        </div>
      )}

      {/* Success notification */}
      {success && (
        <div className="mb-4 p-3 bg-[#d1fae5] border-2 border-[#0c1d2d] rounded-xl text-[#065f46] font-display font-black text-xs shadow-[2.5px_2.5px_0_#000000] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSignup} className="space-y-4">
        {/* Username */}
        <div>
          <label
            htmlFor="signup-username"
            className="block mb-1 text-xs font-display font-black tracking-wider text-black uppercase"
          >
            CHOOSE USERNAME
          </label>
          <div className="flex items-center bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] focus-within:shadow-[3px_3px_0_#38aef0] overflow-hidden transition-shadow">
            <span className="px-3.5 py-3 border-r-2 border-[#0c1d2d] bg-[#f1f5f9] text-black font-display font-black text-sm flex items-center">
              <User className="w-4 h-4 text-black mr-1" />
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
              className="w-full py-3 px-3 outline-none font-display font-bold text-sm bg-transparent placeholder:text-black/35"
            />
          </div>

          {/* Real-time username feedback pill */}
          {username.trim() && (
            <div className="mt-2">
              {checkingUsername ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#fef3c7] border-2 border-[#0c1d2d] rounded-full font-display font-bold text-xs shadow-[1.5px_1.5px_0_#0c1d2d]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking handle availability...</span>
                </div>
              ) : usernameStatus ? (
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 border-2 border-[#0c1d2d] rounded-full font-display font-bold text-xs shadow-[1.5px_1.5px_0_#0c1d2d] ${
                    !usernameStatus.isValid
                      ? 'bg-[#fee2e2] text-[#991b1b]'
                      : usernameStatus.isAvailable
                      ? 'bg-[#d1fae5] text-[#065f46]'
                      : 'bg-[#fee2e2] text-[#991b1b]'
                  }`}
                >
                  {!usernameStatus.isValid ? (
                    <>
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{usernameStatus.message}</span>
                    </>
                  ) : usernameStatus.isAvailable ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Handle is available!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Username is taken</span>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <p className="mt-1 font-mono text-[10px] text-black/60 font-semibold">
            3–20 characters • letters, numbers, _, -, .
          </p>
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="signup-confirm-password"
            className="block mb-1 text-xs font-display font-black tracking-wider text-black uppercase"
          >
            CONFIRM PASSWORD
          </label>
          <div className="flex items-center bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] focus-within:shadow-[3px_3px_0_#38aef0] overflow-hidden transition-shadow">
            <span className="px-3.5 py-3 border-r-2 border-[#0c1d2d] bg-[#f1f5f9] text-black flex items-center">
              <Lock className="w-4 h-4 text-black" />
            </span>
            <input
              id="signup-confirm-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create your secure password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full py-3 px-3 outline-none font-display font-bold text-sm bg-transparent placeholder:text-black/35"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="px-3 text-black/60 hover:text-black transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="mt-1 font-mono text-[10px] text-black/60 font-semibold">
            Min 8 chars with uppercase, lowercase, number & special char
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || oauthLoading !== null || checkingUsername}
          className="w-full py-3.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3.5px_3.5px_0_#000000] font-display font-black text-sm tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
        >
          <span>{loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 h-[2px] bg-black/15" />
        <span className="font-mono text-[10px] font-black tracking-widest text-black/50 uppercase">
          OR SIGN UP WITH
        </span>
        <div className="flex-1 h-[2px] bg-black/15" />
      </div>

      {/* OAuth Buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={loading || oauthLoading !== null}
          className="w-full py-2.5 px-4 bg-white hover:bg-[#f8fafc] border-2 border-[#0c1d2d] rounded-xl shadow-[2.5px_2.5px_0_#000000] font-display font-black text-xs tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-between"
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
            <span>{oauthLoading === 'google' ? 'CONNECTING...' : 'CONTINUE WITH GOOGLE'}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleGithubSignup}
          disabled={loading || oauthLoading !== null}
          className="w-full py-2.5 px-4 bg-white hover:bg-[#f8fafc] border-2 border-[#0c1d2d] rounded-xl shadow-[2.5px_2.5px_0_#000000] font-display font-black text-xs tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 shrink-0 text-black fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.25c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.76.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5z" />
            </svg>
            <span>{oauthLoading === 'github' ? 'CONNECTING...' : 'CONTINUE WITH GITHUB'}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Switch to Login */}
      <div className="mt-6 pt-4 border-t-2 border-[#0c1d2d]/10 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="text-xs font-display font-bold text-black/60">
          Already on Apticks?
        </span>
        <Link
          to="/login"
          className="text-xs font-display font-black text-[#071a2b] hover:text-[#2563eb] border-2 border-[#0c1d2d] rounded-lg bg-[#ffd43b] px-3.5 py-1.5 shadow-[2px_2px_0_#0c1d2d] uppercase tracking-wider transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
        >
          SIGN IN →
        </Link>
      </div>
    </AuthShell>
  )
}