// React hook for managing form state
import { useState } from 'react'

// React Router navigation
import { Link } from 'react-router-dom'

// Supabase client
import { supabase } from '../../lib/supabase'

// Forgot password styling
import './ForgotPassword.css'


// Forgot Password component
function ForgotPassword() {

  // -----------------------------
  // Form state
  // -----------------------------

  // Email entered by the user
  const [email, setEmail] = useState('')

  // Loading state
  const [loading, setLoading] = useState(false)

  // Error message
  const [error, setError] = useState('')

  // Success message
  const [success, setSuccess] = useState('')


  // -----------------------------
  // Reset password handler
  // -----------------------------

  const handleResetPassword = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {

    // Prevent normal browser form submission
    event.preventDefault()

    // Clear previous messages
    setError('')
    setSuccess('')


    // -----------------------------
    // Validation
    // -----------------------------

    if (!email.trim()) {

      setError(
        'Please enter your email.'
      )

      return
    }


    // Start loading
    setLoading(true)


    try {

      // Send password reset email
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          {
            redirectTo:
              'http://localhost:5173/update-password',
          }
        )


      // Supabase error
      if (resetError) {

        setError(
          resetError.message
        )

        return
      }


      // Success
      setSuccess(
        'Reset link sent! Check your email to continue.'
      )

    } catch (err) {

      // Log unexpected errors
      console.error(
        'Password reset error:',
        err
      )

      setError(
        'Something went wrong. Please try again.'
      )

    } finally {

      // Stop loading
      setLoading(false)

    }

  }


  // -----------------------------
  // UI
  // -----------------------------

  return (
    <div className="forgot-page">


      {/* =================================
          Decorative background objects
          ================================= */}

      <div className="forgot-floating forgot-plus">
        +
      </div>

      <div className="forgot-floating forgot-number">
        7
      </div>

      <div className="forgot-floating forgot-cross">
        ×
      </div>

      <div className="forgot-floating forgot-equals">
        =
      </div>

      <div className="forgot-floating forgot-number-two">
        2
      </div>


      {/* Floating clock */}
      <div className="forgot-clock">

        <div className="forgot-clock-hour" />

        <div className="forgot-clock-minute" />

        <div className="forgot-clock-center" />

      </div>


      {/* =================================
          Main card
          ================================= */}

      <main className="forgot-card">


        {/* AptiVerse logo */}
        <div className="forgot-brand">

          <div className="forgot-logo">
            A
          </div>

          <span>
            APTIVERSE
          </span>

        </div>


        {/* Small label */}
        <div className="forgot-label">
          ACCOUNT RECOVERY
        </div>


        {/* Heading */}
        <h1>
          FORGOT
          <br />
          PASSWORD?
        </h1>


        {/* Description */}
        <p className="forgot-description">
          No worries. Enter the email connected
          to your AptiVerse account and we'll send
          you a reset link.
        </p>


        {/* Form */}
        <form
          onSubmit={handleResetPassword}
        >


          {/* Email */}
          <div className="forgot-form-group">

            <label htmlFor="forgot-email">
              EMAIL
            </label>


            <div className="forgot-input-wrapper">

              <span className="forgot-input-icon">
                @
              </span>

              <input
                id="forgot-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                autoComplete="email"
              />

            </div>

          </div>


          {/* Error */}
          {error && (

            <p className="forgot-message forgot-error">
              {error}
            </p>

          )}


          {/* Success */}
          {success && (

            <p className="forgot-message forgot-success">
              {success}
            </p>

          )}


          {/* Submit */}
          <button
            type="submit"
            className="forgot-submit"
            disabled={loading}
          >

            {loading
              ? 'SENDING...'
              : 'SEND RESET LINK →'}

          </button>

        </form>


        {/* Back to login */}
        <Link
          to="/login"
          className="forgot-back"
        >
          ← BACK TO SIGN IN
        </Link>


        {/* Bottom note */}
        <div className="forgot-note">
          <span>?</span>

          <p>
            You'll receive an email with a
            secure password reset link.
          </p>
        </div>

      </main>

    </div>
  )
}


// Export component
export default ForgotPassword