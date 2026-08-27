// React hook for managing form state
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './ForgotPassword.css'

function ForgotPassword() {
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const cleanInput = identifier.trim()

    if (!cleanInput) {
      setError('Please enter your username or email address.')
      return
    }

    setLoading(true)

    try {
      // 1. Invoke server-side request-password-reset Edge Function (prevents email enumeration)
      const { data, error: fnError } = await supabase.functions.invoke('request-password-reset', {
        body: { identifier: cleanInput },
      })

      if (data?.unverified) {
        setError(data.message || 'Add and verify an email from your Profile to enable account recovery.')
        return
      }

      if (fnError) {
        // Fallback: If input is an email address, trigger direct reset
        if (cleanInput.includes('@') && !cleanInput.endsWith('@apticks.app') && !cleanInput.endsWith('@auth.apticks.internal') && !cleanInput.endsWith('@aptiverse.local')) {
          const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
            cleanInput.toLowerCase(),
            {
              redirectTo: `${window.location.origin}/update-password`,
            }
          )
          if (resetErr) {
            console.warn('Password reset fallback notice:', resetErr)
          }
        }
      }

      setSuccess(
        data?.message ||
          'If an account exists with a verified email, a password reset link has been sent. Check your inbox.'
      )
    } catch (err: unknown) {
      console.error('Password reset error:', err)
      setSuccess('If an account exists with a verified email, a password reset link has been sent.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="forgot-page">
      {/* Decorative background objects */}
      <div className="forgot-floating forgot-plus">+</div>
      <div className="forgot-floating forgot-number">7</div>
      <div className="forgot-floating forgot-cross">×</div>
      <div className="forgot-floating forgot-equals">=</div>
      <div className="forgot-floating forgot-number-two">2</div>

      {/* Floating clock */}
      <div className="forgot-clock">
        <div className="forgot-clock-hour" />
        <div className="forgot-clock-minute" />
        <div className="forgot-clock-center" />
      </div>

      {/* Main card */}
      <main className="forgot-card">
        {/* AptiVerse logo */}
        <div className="forgot-brand">
          <div className="forgot-logo">A</div>
          <span>APTIVERSE</span>
        </div>

        {/* Small label */}
        <div className="forgot-label">ACCOUNT RECOVERY</div>

        {/* Heading */}
        <h1>
          FORGOT
          <br />
          PASSWORD?
        </h1>

        {/* Description */}
        <p className="forgot-description">
          Enter your username or verified email connected to your AptiVerse account and we'll send you a secure reset link.
        </p>

        {/* Form */}
        <form onSubmit={handleResetPassword}>
          {/* Username or Email */}
          <div className="forgot-form-group">
            <label htmlFor="forgot-identifier">USERNAME OR EMAIL</label>

            <div className="forgot-input-wrapper">
              <span className="forgot-input-icon">@</span>

              <input
                id="forgot-identifier"
                type="text"
                placeholder="Enter username or email"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          {/* Error */}
          {error && <p className="forgot-message forgot-error">{error}</p>}

          {/* Success */}
          {success && <p className="forgot-message forgot-success">{success}</p>}

          {/* Submit */}
          <button type="submit" className="forgot-submit" disabled={loading}>
            {loading ? 'SENDING...' : 'SEND RESET LINK →'}
          </button>
        </form>

        {/* Back to login */}
        <Link to="/login" className="forgot-back">
          ← BACK TO SIGN IN
        </Link>

        {/* Bottom note */}
        <div className="forgot-note">
          <span>?</span>
          <p>You'll receive an email with a secure password reset link if a real email is linked.</p>
        </div>
      </main>
    </div>
  )
}

export default ForgotPassword