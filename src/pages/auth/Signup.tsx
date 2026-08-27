import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ProfileService, type UsernameValidationResult } from '../../services/profileService'
import { validatePassword, normalizeUsername } from '../../utils/validation'
import './Signup.css'

function Signup() {
  const navigate = useNavigate()

  // -----------------------------
  // Form state
  // -----------------------------

  const [username, setUsername] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Password visibility
  const [showPassword, setShowPassword] = useState(false)

  // Loading state
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

    // 1. Username validation
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

    // 2. Password validation (single Confirm Password input)
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
        console.warn('Edge Function not reachable, using fallback:', fnErr)
      }

      // 2. Direct client fallback if Edge Function is not yet deployed to remote Supabase
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
          // Ensure profile is created
          await supabase.from('profiles').upsert({
            id: signUpData.user.id,
            username: cleanUsername,
            display_name: cleanUsername,
            updated_at: new Date().toISOString(),
          })

          if (signUpData.session) {
            sessionEstablished = true
          } else {
            // Sign in directly
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

      // 3. Immediately land on Dashboard as a fully authenticated user
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
  // Google Signup
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

  // -----------------------------
  // GitHub Signup
  // -----------------------------

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

  // -----------------------------
  // UI
  // -----------------------------

  return (
    <div className="signup-page">
      {/* =====================================
          FLOATING BACKGROUND OBJECTS
          ===================================== */}

      <div className="signup-floating-object signup-plus">+</div>
      <div className="signup-floating-object signup-equals">=</div>
      <div className="signup-floating-object signup-five">5</div>
      <div className="signup-floating-object signup-seven">7</div>
      <div className="signup-floating-object signup-two">2</div>
      <div className="signup-floating-object signup-cross">×</div>
      <div className="signup-floating-equation">× × ×</div>

      {/* Floating clock */}
      <div className="signup-floating-clock">
        <div className="signup-clock-hand signup-clock-hour" />
        <div className="signup-clock-hand signup-clock-minute" />
        <div className="signup-clock-center" />
      </div>

      {/* =====================================
          MAIN CARD
          ===================================== */}

      <main className="signup-card">
        {/* ===================================
            LEFT BRAND PANEL
            =================================== */}

        <section className="signup-brand-panel">
          <div className="signup-brand-header">
            <div className="signup-brand-logo">A</div>
            <span className="signup-brand-name">APTIVERSE</span>
          </div>

          <div className="signup-brand-label">APTITUDE • SPEED • COMPETITION</div>

          <h1 className="signup-brand-heading">
            THINK.
            <br />
            SOLVE.
            <br />
            <span>BEAT THE</span>
            <br />
            <span>CLOCK.</span>
          </h1>

          <p className="signup-brand-description">
            Build your profile.
            <br />
            Sharpen your aptitude.
            <br />
            Compete with everyone.
          </p>

          <div className="signup-red-shape" />
          <div className="signup-yellow-circle" />

          <div className="signup-feature-strip">
            <div className="signup-feature-card signup-feature-yellow">
              <strong>01</strong>
              <span>DAILY</span>
              <span>CHALLENGES</span>
              <b>□</b>
            </div>

            <div className="signup-feature-card signup-feature-red">
              <strong>02</strong>
              <span>1v1</span>
              <span>BATTLES</span>
              <b>×</b>
            </div>

            <div className="signup-feature-card signup-feature-white">
              <strong>03</strong>
              <span>LIVE</span>
              <span>CONTESTS</span>
              <b>♛</b>
            </div>
          </div>
        </section>

        {/* ===================================
            RIGHT FORM PANEL
            =================================== */}

        <section className="signup-form-panel">
          <div className="signup-form-eyebrow">JOIN APTIVERSE</div>

          <h2>CREATE ACCOUNT</h2>

          <p className="signup-form-subtitle">Create your username and start competing.</p>

          {/* =================================
              FORM
              ================================= */}

          <form onSubmit={handleSignup}>
            {/* Username */}
            <div className="signup-form-group">
              <label htmlFor="signup-username">USERNAME</label>

              <div className="signup-input-wrapper">
                <span className="signup-input-icon">@</span>

                <input
                  id="signup-username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value)
                    if (!event.target.value.trim()) {
                      setUsernameStatus(null)
                    }
                  }}
                  maxLength={20}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              {/* Username Availability Feedback */}
              {username.trim() && (
                <>
                  {checkingUsername ? (
                    <div className="signup-username-status checking">
                      <span>Checking availability...</span>
                    </div>
                  ) : usernameStatus ? (
                    <div
                      className={`signup-username-status ${
                        !usernameStatus.isValid
                          ? 'invalid'
                          : usernameStatus.isAvailable
                          ? 'available'
                          : 'taken'
                      }`}
                    >
                      <span>
                        {!usernameStatus.isValid
                          ? `✕ ${usernameStatus.message}`
                          : usernameStatus.isAvailable
                          ? `✓ This username is available`
                          : `✕ This username is already taken`}
                      </span>
                    </div>
                  ) : null}
                </>
              )}

              <p className="signup-input-hint">3–20 characters • letters, numbers, _, -, .</p>
            </div>

            {/* Confirm Password (Single Password Field) */}
            <div className="signup-form-group">
              <label htmlFor="signup-confirm-password">CONFIRM PASSWORD</label>

              <div className="signup-input-wrapper signup-password-wrapper">
                <span className="signup-input-icon">🔒</span>

                <input
                  id="signup-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create your password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />

                {/* Eye button */}
                <button
                  type="button"
                  className="signup-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 10 8-0.6 1.6-1.6 3-2.9 4.2" />
                      <path d="M6.6 6.6C4.7 7.8 3.4 9.7 2 12c1.5 4 5 8 10 8 1 0 2-.2 2.9-.5" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <p className="signup-input-hint">Min 8 chars with uppercase, lowercase, number & special char</p>
            </div>

            {/* Error Message */}
            {error && <p className="signup-form-error">{error}</p>}

            {/* Success Message */}
            {success && <p className="signup-form-success">{success}</p>}

            {/* Create Account Button */}
            <button
              type="submit"
              className="signup-submit-button"
              disabled={loading || oauthLoading !== null || checkingUsername}
            >
              {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT →'}
            </button>
          </form>

          {/* =================================
              DIVIDER
              ================================= */}

          <div className="signup-divider">
            <span />
            <strong>OR SIGN UP WITH</strong>
            <span />
          </div>

          {/* Google */}
          <button
            type="button"
            className="signup-oauth-button"
            onClick={handleGoogleSignup}
            disabled={loading || oauthLoading !== null}
          >
            <svg className="signup-oauth-icon" viewBox="0 0 24 24" aria-hidden="true">
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
            <b>→</b>
          </button>

          {/* GitHub */}
          <button
            type="button"
            className="signup-oauth-button"
            onClick={handleGithubSignup}
            disabled={loading || oauthLoading !== null}
          >
            <svg className="signup-oauth-icon signup-github-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.25c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.76.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5z"
              />
            </svg>
            <span>{oauthLoading === 'github' ? 'CONNECTING...' : 'CONTINUE WITH GITHUB'}</span>
            <b>→</b>
          </button>

          {/* =================================
              LOGIN BOX
              ================================= */}

          <div className="signup-login-box">
            <div className="signup-login-text">
              <strong>ALREADY ON APTIVERSE?</strong>
              <span>Sign in and continue your journey.</span>
            </div>

            <Link to="/login" className="signup-login-button">
              SIGN IN →
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Signup