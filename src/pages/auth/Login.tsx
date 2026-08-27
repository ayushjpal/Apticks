import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { normalizeUsername } from '../../utils/validation'
import './Login.css'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  // -----------------------------
  // Form state
  // -----------------------------

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Show / hide password
  const [showPassword, setShowPassword] = useState(false)

  // Loading state
  const [loading, setLoading] = useState(false)

  // OAuth loading state
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)

  // Messages
  const [error, setError] = useState<string>(
    (location.state as { error?: string })?.error || ''
  )
  const [infoMessage] = useState<string>(
    (location.state as { message?: string })?.message || ''
  )

  // -----------------------------
  // Username + Password Login
  // -----------------------------

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setError('')

    const cleanUsername = normalizeUsername(username)

    // Validation
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

      // 1. Authenticate via secure server-side Edge Function (Zero client-side email exposure)
      try {
        const { data: authResult, error: fnError } = await supabase.functions.invoke(
          'login-with-username',
          {
            body: {
              username: cleanUsername,
              password,
            },
          }
        )

        if (!fnError && authResult?.session) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: authResult.session.access_token,
            refresh_token: authResult.session.refresh_token,
          })

          if (!sessionError) {
            sessionEstablished = true
          }
        } else if (authResult?.error && !fnError) {
          setError(authResult.error)
          return
        }
      } catch (fnErr) {
        console.warn('Login Edge Function not reachable, trying direct fallback:', fnErr)
      }

      // 2. Direct client fallback if Edge Function is not deployed
      if (!sessionEstablished) {
        const systemIdentifier = `u_${cleanUsername}@apticks.app`

        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: systemIdentifier,
          password,
        })

        if (!signInErr && signInData.session) {
          sessionEstablished = true
        } else {
          // If system identifier failed, check if user entered an email-based account
          if (cleanUsername.includes('@')) {
            const { data: emailSignIn, error: emailErr } = await supabase.auth.signInWithPassword({
              email: cleanUsername,
              password,
            })
            if (!emailErr && emailSignIn.session) {
              sessionEstablished = true
            }
          }
        }
      }

      if (!sessionEstablished) {
        setError('Invalid username or password. Please try again.')
        return
      }

      // 3. Verify user profile exists and has username
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()

        if (!profile || !profile.username) {
          navigate('/choose-username', { replace: true })
          return
        }
      }

      // 4. Successful login -> Dashboard
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      console.error('Login error:', err)
      setError('Invalid username or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // -----------------------------
  // Google Login
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
        setError(oauthError.message)
        setOauthLoading(null)
      }
    } catch (err) {
      console.error('Google login error:', err)
      setError('Unable to continue with Google. Please try again.')
      setOauthLoading(null)
    }
  }

  // -----------------------------
  // GitHub Login
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
        setError(oauthError.message)
        setOauthLoading(null)
      }
    } catch (err) {
      console.error('GitHub login error:', err)
      setError('Unable to continue with GitHub. Please try again.')
      setOauthLoading(null)
    }
  }

  // -----------------------------
  // UI
  // -----------------------------

  return (
    <div className="login-page">
      {/* =========================================
          FLOATING BACKGROUND OBJECTS
          ========================================= */}

      <div className="floating-object object-plus">+</div>
      <div className="floating-object object-equals">=</div>
      <div className="floating-object object-five">5</div>
      <div className="floating-object object-seven">7</div>
      <div className="floating-object object-two">2</div>
      <div className="floating-object object-cross">×</div>
      <div className="floating-equation">× × ×</div>

      {/* Floating clock */}
      <div className="floating-clock">
        <div className="clock-hand clock-hour" />
        <div className="clock-hand clock-minute" />
        <div className="clock-center" />
      </div>

      {/* =========================================
          MAIN LOGIN CARD
          ========================================= */}

      <main className="login-card">
        {/* =====================================
            LEFT BRAND PANEL
            ===================================== */}

        <section className="brand-panel">
          {/* Logo / Brand */}
          <div className="brand-header">
            <div className="brand-logo">A</div>
            <span className="brand-name">APTIVERSE</span>
          </div>

          {/* Small label */}
          <div className="brand-label">APTITUDE • SPEED • COMPETITION</div>

          {/* Main heading */}
          <h1 className="brand-heading">
            THINK.
            <br />
            SOLVE.
            <br />
            <span>BEAT THE</span>
            <br />
            <span>CLOCK.</span>
          </h1>

          {/* Description */}
          <p className="brand-description">
            Sharpen your aptitude.
            <br />
            Compete with everyone.
            <br />
            Keep your streak alive.
          </p>

          {/* Decorative shapes */}
          <div className="red-shape" />
          <div className="yellow-circle" />

          {/* Bottom feature cards */}
          <div className="feature-strip">
            <div className="feature-card feature-yellow">
              <strong>01</strong>
              <span>DAILY</span>
              <span>CHALLENGES</span>
              <b>□</b>
            </div>

            <div className="feature-card feature-red">
              <strong>02</strong>
              <span>1v1</span>
              <span>BATTLES</span>
              <b>×</b>
            </div>

            <div className="feature-card feature-white">
              <strong>03</strong>
              <span>LIVE</span>
              <span>CONTESTS</span>
              <b>♛</b>
            </div>
          </div>
        </section>

        {/* =====================================
            RIGHT LOGIN PANEL
            ===================================== */}

        <section className="form-panel">
          {/* Small heading */}
          <div className="form-eyebrow">APTIVERSE ACCOUNT</div>

          {/* Main heading */}
          <h2>SIGN IN</h2>

          <p className="form-subtitle">Enter your username and password to continue.</p>

          {/* Info notification if passed from signup/update */}
          {infoMessage && (
            <p className="form-error" style={{ background: '#d1fae5', color: '#065f46', borderColor: '#050505' }}>
              {infoMessage}
            </p>
          )}

          {/* =================================
              LOGIN FORM (USERNAME + PASSWORD)
              ================================= */}

          <form onSubmit={handleLogin}>
            {/* Username */}
            <div className="form-group">
              <label htmlFor="login-username">USERNAME</label>

              <div className="input-wrapper">
                <span className="input-icon">@</span>

                <input
                  id="login-username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  maxLength={20}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="login-password">PASSWORD</label>

              <div className="input-wrapper password-wrapper">
                <span className="input-icon">♙</span>

                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />

                {/* Eye button */}
                <button
                  type="button"
                  className="password-toggle"
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
            </div>

            {/* Remember + Forgot */}
            <div className="form-options">
              <label className="remember-label">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>

              <Link to="/forgot-password" className="forgot-password">
                Forgot password?
              </Link>
            </div>

            {/* Error Message */}
            {error && <p className="form-error">{error}</p>}

            {/* Sign in button */}
            <button
              type="submit"
              className="login-button"
              disabled={loading || oauthLoading !== null}
            >
              {loading ? 'SIGNING IN...' : 'SIGN IN →'}
            </button>
          </form>

          {/* =================================
              DIVIDER
              ================================= */}

          <div className="divider">
            <span />
            <strong>OR CONTINUE WITH</strong>
            <span />
          </div>

          {/* =================================
              GOOGLE
              ================================= */}

          <button
            type="button"
            className="oauth-button"
            onClick={handleGoogleLogin}
            disabled={loading || oauthLoading !== null}
          >
            <svg className="oauth-icon google-icon" viewBox="0 0 24 24" aria-hidden="true">
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

            <span>
              {oauthLoading === 'google' ? 'CONNECTING...' : 'CONTINUE WITH GOOGLE'}
            </span>
            <b>→</b>
          </button>

          {/* =================================
              GITHUB
              ================================= */}

          <button
            type="button"
            className="oauth-button"
            onClick={handleGithubLogin}
            disabled={loading || oauthLoading !== null}
          >
            <svg className="oauth-icon github-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.25c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.76.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5z"
              />
            </svg>

            <span>
              {oauthLoading === 'github' ? 'CONNECTING...' : 'CONTINUE WITH GITHUB'}
            </span>
            <b>→</b>
          </button>

          {/* =================================
              CREATE ACCOUNT
              ================================= */}

          <div className="create-account-box">
            <div className="create-account-text">
              <strong>NEW TO APTIVERSE?</strong>
              <span>Create your account and start competing.</span>
            </div>

            <Link to="/signup" className="create-account-button">
              CREATE ACCOUNT →
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Login