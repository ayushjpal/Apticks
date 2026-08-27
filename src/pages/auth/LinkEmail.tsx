import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { validatePassword } from '../../utils/validation'
import './LinkEmail.css'

export default function LinkEmail() {
  const navigate = useNavigate()
  const location = useLocation()

  // In-memory volatile password passed from Signup (never written to persistent storage)
  const pendingPasswordFromState = (location.state as { pendingPassword?: string; username?: string })?.pendingPassword
  const usernameFromState = (location.state as { pendingPassword?: string; username?: string })?.username

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(pendingPasswordFromState || '')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [currentUsername, setCurrentUsername] = useState<string | null>(usernameFromState || null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    async function checkCurrentSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          navigate('/login', { replace: true })
          return
        }

        const user = session.user
        const metaUsername = user.user_metadata?.username || user.email?.split('@')[0]
        if (!currentUsername && metaUsername) {
          setCurrentUsername(metaUsername)
        }

        // Check if there is already a pending new_email
        if (user.new_email) {
          setSubmittedEmail(user.new_email)
        } else if (user.email && !user.is_anonymous) {
          // If the user already has a real email confirmed and is not anonymous, proceed to dashboard
          navigate('/dashboard', { replace: true })
          return
        }
      } catch (err) {
        console.warn('Session check note in LinkEmail:', err)
      } finally {
        setCheckingAuth(false)
      }
    }

    checkCurrentSession()
  }, [navigate, currentUsername])

  async function handleLinkEmail(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    const finalPassword = password || pendingPasswordFromState
    if (!finalPassword) {
      setError('Please enter your account password to confirm.')
      return
    }

    const passValidation = validatePassword(finalPassword)
    if (!passValidation.isValid) {
      setError(passValidation.message)
      return
    }

    setLoading(true)
    try {
      // Execute in-place identity upgrade on existing Supabase Auth identity
      // Converts anonymous user -> permanent email/password user (retaining the exact same UUID)
      const { data, error: updateError } = await supabase.auth.updateUser({
        email: cleanEmail,
        password: finalPassword,
      })

      if (updateError) {
        setError(updateError.message || 'Could not link email. Please try again.')
      } else if (data.user) {
        setSubmittedEmail(cleanEmail)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    if (!submittedEmail) return
    setError(null)
    setResending(true)
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'email_change',
        email: submittedEmail,
      })
      if (resendErr) {
        setError(resendErr.message || 'Failed to resend verification email.')
      } else {
        alert(`Verification email resent to ${submittedEmail}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend verification.'
      setError(msg)
    } finally {
      setResending(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="link-email-page">
        <main className="link-email-main">
          <div className="link-email-card" style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 900 }}>LOADING ACCOUNT...</p>
          </div>
        </main>
      </div>
    )
  }

  const needsPasswordPrompt = !pendingPasswordFromState

  return (
    <div className="link-email-page">
      <header className="link-email-header">
        <Link to="/" className="link-email-brand">
          APTIVERSE
        </Link>
        <span className="link-email-badge">ACCOUNT SETUP</span>
      </header>

      <main className="link-email-main">
        <section className="link-email-card">
          <div className="link-email-title-group">
            <h1 className="link-email-title">
              {submittedEmail ? 'CHECK YOUR INBOX' : 'LINK REAL EMAIL'}
            </h1>
            <p className="link-email-subtitle">
              {submittedEmail
                ? `Verification link sent to ${submittedEmail}. Confirm your email to enable password recovery.`
                : `Connect a real Gmail or personal email to ${
                    currentUsername ? `@${currentUsername}` : 'your account'
                  } for account recovery and official leaderboard verification.`}
            </p>
          </div>

          {error && <div className="link-email-error">{error}</div>}

          {submittedEmail ? (
            <div className="link-email-pending-box">
              <span className="link-email-pending-badge">VERIFICATION PENDING</span>
              <h3 className="link-email-pending-title">Action Required</h3>
              <p className="link-email-pending-text">
                Click the confirmation link sent to <strong>{submittedEmail}</strong> to link your
                email permanently. You can continue practicing while verification is in progress.
              </p>

              <div className="link-email-actions">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="link-email-dashboard-btn"
                >
                  CONTINUE TO DASHBOARD →
                </button>

                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resending}
                  className="link-email-resend-btn"
                >
                  {resending ? 'RESENDING...' : '↻ Resend Verification Email'}
                </button>

                <button
                  type="button"
                  onClick={() => setSubmittedEmail(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 750,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    marginTop: '4px',
                  }}
                >
                  Use a different email address
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLinkEmail}>
              <div className="link-email-field">
                <label htmlFor="real-email" className="link-email-label">
                  REAL EMAIL / GMAIL
                </label>
                <div className="link-email-input-wrapper">
                  <span className="link-email-input-icon">✉</span>
                  <input
                    id="real-email"
                    type="email"
                    placeholder="yourname@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="link-email-input"
                  />
                </div>
              </div>

              {/* If password was not in memory (e.g. page reloaded), prompt user to confirm password */}
              {needsPasswordPrompt && (
                <div className="link-email-field">
                  <label htmlFor="confirm-pass" className="link-email-label">
                    CONFIRM PASSWORD
                  </label>
                  <div className="link-email-input-wrapper">
                    <span className="link-email-input-icon">🔒</span>
                    <input
                      id="confirm-pass"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="link-email-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '0 10px',
                        cursor: 'pointer',
                        fontWeight: 900,
                        fontSize: '11px',
                      }}
                    >
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </button>
                  </div>
                  <p style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280', marginTop: '4px' }}>
                    Min 8 chars with uppercase, lowercase, number & special char
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="link-email-submit-btn"
              >
                {loading ? 'SENDING LINK...' : 'SEND VERIFICATION LINK →'}
              </button>
            </form>
          )}

          <div className="link-email-footer-info">
            <span style={{ fontSize: '14px' }}>🔒</span>
            <span>
              Your real email is kept private and will never be shown on public profiles or during login.
            </span>
          </div>
        </section>
      </main>
    </div>
  )
}
