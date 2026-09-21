import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, User, Lock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ProfileService, type UsernameValidationResult } from '../../services/profileService'
import { validatePassword, normalizeUsername } from '../../utils/validation'
import AuthBackground from '../../components/auth/AuthBackground'
import AuthInput from '../../components/auth/AuthInput'
import AuthPrimaryButton from '../../components/auth/AuthPrimaryButton'
import AuthSocialButton from '../../components/auth/AuthSocialButton'
import AuthAlert from '../../components/auth/AuthAlert'

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

  // Clean username for live presentation preview (no backend calls for preview display)
  const displayHandle = username.trim().toLowerCase() || 'speed_solver'
  const displayInitials = displayHandle.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'SS'

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
    <AuthBackground
      variant="signup"
      navRight={
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
          <span className="hidden sm:inline">Already on Apticks?</span>
          <Link
            to="/login"
            className="font-display font-semibold text-[#ffd43b] hover:text-[#facc15] transition-colors inline-flex items-center gap-1"
          >
            <span>Sign in</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      }
    >
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* ======================================================= */}
        {/* LEFT: EDITORIAL SECTION                                 */}
        {/* ======================================================= */}
        <div className="lg:col-span-4 flex flex-col justify-start pt-1">
          <div className="font-mono text-xs sm:text-sm tracking-[0.25em] text-[#ffd43b]/90 font-bold uppercase mb-3">
            02
          </div>
          <div className="w-12 sm:w-16 h-px bg-slate-700/80 mb-6 sm:mb-8" />
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.05]">
            Create<br />
            Your<br />
            <span className="text-[#ffd43b]">Competitor.</span>
          </h1>
          <p className="font-display text-base sm:text-lg font-semibold text-slate-200 mt-6 sm:mt-8">
            Start your journey in the arena.
          </p>

          {/* Progress Indicator */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t border-slate-800/80 font-mono text-xs">
            <div className="flex items-center gap-2 text-[#ffd43b] font-bold">
              <span className="w-5 h-5 rounded-full bg-[#ffd43b]/15 border border-[#ffd43b] flex items-center justify-center text-[10px]">
                01
              </span>
              <span className="tracking-wider uppercase text-[11px]">Identity</span>
            </div>
            <div className="w-6 h-px bg-slate-700" />
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-400">
                02
              </span>
              <span className="tracking-wider uppercase text-[11px]">Access</span>
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* CENTER: FORM AREA                                       */}
        {/* ======================================================= */}
        <div className="lg:col-span-5 bg-[#0c1d2d] border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
          {/* Top Yellow Accent */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#ffd43b]/40 to-transparent" />

          {/* Error Notification */}
          {error && <AuthAlert type="error" message={error} className="mb-4" />}

          {/* Success Notification */}
          {success && <AuthAlert type="success" message={success} className="mb-4" />}

          {/* Signup Form */}
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Username Input */}
            <div>
              <AuthInput
                id="signup-username"
                label="CHOOSE USERNAME"
                icon={<User className="w-3.5 h-3.5" />}
                prefixText="@"
                placeholder="username"
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
                helperText="3–20 characters • letters, numbers, _, -, ."
              />

              {/* Real-time username availability pill */}
              {username.trim() && (
                <div className="mt-2">
                  {checkingUsername ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-400/10 border border-amber-400/25 rounded-lg text-[#ffd43b] font-mono text-xs">
                      <Loader2 className="w-3 h-3 animate-spin text-[#ffd43b]" />
                      <span>Checking availability...</span>
                    </div>
                  ) : usernameStatus ? (
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg font-mono text-xs ${
                        !usernameStatus.isValid
                          ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                          : usernameStatus.isAvailable
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                      }`}
                    >
                      {!usernameStatus.isValid ? (
                        <>
                          <XCircle className="w-3 h-3 shrink-0 text-rose-400" />
                          <span>{usernameStatus.message}</span>
                        </>
                      ) : usernameStatus.isAvailable ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-400" />
                          <span>Handle is available</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 shrink-0 text-rose-400" />
                          <span>Username is taken</span>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Password Input */}
            <AuthInput
              id="signup-confirm-password"
              label="PASSWORD"
              type={showPassword ? 'text' : 'password'}
              icon={<Lock className="w-3.5 h-3.5" />}
              placeholder="Create your secure password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              helperText="Min 8 chars with uppercase, lowercase, number & special char"
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

            {/* Submit CTA */}
            <div className="pt-2">
              <AuthPrimaryButton
                type="submit"
                disabled={loading || oauthLoading !== null || checkingUsername}
                loading={loading}
                loadingText="Creating Account..."
              >
                Create Account
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

          {/* Compact OAuth Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <AuthSocialButton
              provider="google"
              compact
              onClick={handleGoogleSignup}
              loading={oauthLoading === 'google'}
              disabled={loading || oauthLoading !== null}
            />
            <AuthSocialButton
              provider="github"
              compact
              onClick={handleGithubSignup}
              loading={oauthLoading === 'github'}
              disabled={loading || oauthLoading !== null}
            />
          </div>
        </div>

        {/* ======================================================= */}
        {/* RIGHT: COMPACT LIVE PREVIEW CARD                        */}
        {/* ======================================================= */}
        <aside className="lg:col-span-3 w-full">
          <div className="bg-[#0c1d2d]/90 border border-slate-800 hover:border-[#ffd43b]/40 rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all group">
            {/* Subtle top indicator */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#ffd43b]/30 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80 mb-5">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                LIVE PREVIEW
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#ffd43b]/10 border border-[#ffd43b]/30 text-[#ffd43b] font-mono text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffd43b] animate-pulse" />
                ACTIVE
              </span>
            </div>

            {/* Profile Monogram & Handle */}
            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#071a2b] border border-[#ffd43b]/40 flex items-center justify-center font-display font-black text-base text-[#ffd43b] shadow-inner shrink-0">
                {displayInitials}
              </div>

              <div className="min-w-0">
                <div className="font-mono text-sm font-bold text-white truncate">
                  @{displayHandle}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[11px]">
                  <span className="text-[#ffd43b] font-bold">LVL 01</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-400">Rookie</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 py-3 px-2 bg-[#071a2b]/80 border border-slate-800 rounded-xl mb-5 font-mono text-center">
              <div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">RANK</div>
                <div className="text-xs font-bold text-slate-300 mt-0.5">—</div>
              </div>

              <div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">XP</div>
                <div className="text-xs font-bold text-[#ffd43b] mt-0.5">0</div>
              </div>

              <div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">STREAK</div>
                <div className="text-xs font-bold text-slate-300 mt-0.5">0</div>
              </div>
            </div>

            {/* Bottom Status */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between font-mono text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                READY TO COMPETE.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </AuthBackground>
  )
}