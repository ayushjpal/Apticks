import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import './Signup.css'

function Signup() {
  // -----------------------------
  // Form state
  // -----------------------------

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Password visibility
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Loading
  const [loading, setLoading] = useState(false)

  // Messages
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')


  // -----------------------------
  // Email signup
  // -----------------------------

  const handleSignup = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()

    setError('')
    setSuccess('')

    const cleanEmail = email.trim().toLowerCase()


    // -----------------------------
    // Email validation
    // -----------------------------

    if (!cleanEmail) {
      setError('Please enter your email.')
      return
    }


    // -----------------------------
    // Password validation
    // -----------------------------

    if (!password) {
      setError('Please create a password.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }


    // -----------------------------
    // Confirm password
    // -----------------------------

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }


    setLoading(true)


    try {

      // -----------------------------
      // Create Supabase account
      // -----------------------------

      const { error: signupError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
        })


      // -----------------------------
      // Signup failed
      // -----------------------------

      if (signupError) {

        console.error(
          'Signup error:',
          signupError
        )

        setError(signupError.message)

        return
      }


      // -----------------------------
      // Email verification required
      // -----------------------------

      setSuccess(
        'Account created! Please check your email and verify your account before signing in.'
      )


      // Clear form

      setEmail('')
      setPassword('')
      setConfirmPassword('')


    } catch (error) {

      console.error(
        'Unexpected signup error:',
        error
      )

      setError(
        'Something went wrong. Please try again.'
      )

    } finally {

      setLoading(false)

    }
  }


  // -----------------------------
  // Google signup
  // -----------------------------

  const handleGoogleSignup = async () => {

    setError('')

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo:
            `${window.location.origin}/auth/callback`,
        },
      })


    if (error) {

      console.error(
        'Google OAuth error:',
        error
      )

      setError(error.message)

    }
  }


  // -----------------------------
  // GitHub signup
  // -----------------------------

  const handleGithubSignup = async () => {

    setError('')

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo:
            `${window.location.origin}/auth/callback`,
        },
      })


    if (error) {

      console.error(
        'GitHub OAuth error:',
        error
      )

      setError(error.message)

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

      <div className="signup-floating-object signup-plus">
        +
      </div>

      <div className="signup-floating-object signup-equals">
        =
      </div>

      <div className="signup-floating-object signup-five">
        5
      </div>

      <div className="signup-floating-object signup-seven">
        7
      </div>

      <div className="signup-floating-object signup-two">
        2
      </div>

      <div className="signup-floating-object signup-cross">
        ×
      </div>

      <div className="signup-floating-equation">
        × × ×
      </div>


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

          {/* Brand */}

          <div className="signup-brand-header">

            <div className="signup-brand-logo">
              A
            </div>

            <span className="signup-brand-name">
              APTIVERSE
            </span>

          </div>


          {/* Label */}

          <div className="signup-brand-label">
            APTITUDE • SPEED • COMPETITION
          </div>


          {/* Heading */}

          <h1 className="signup-brand-heading">

            THINK.
            <br />

            SOLVE.
            <br />

            <span>BEAT THE</span>
            <br />

            <span>CLOCK.</span>

          </h1>


          {/* Description */}

          <p className="signup-brand-description">

            Build your profile.
            <br />

            Sharpen your aptitude.
            <br />

            Compete with everyone.

          </p>


          {/* Red shape */}

          <div className="signup-red-shape" />


          {/* Yellow circle */}

          <div className="signup-yellow-circle" />


          {/* Features */}

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

          <div className="signup-form-eyebrow">
            JOIN APTIVERSE
          </div>


          <h2>
            CREATE ACCOUNT
          </h2>


          <p className="signup-form-subtitle">
            Create your account and start competing.
          </p>


          {/* =================================
              FORM
              ================================= */}

          <form onSubmit={handleSignup}>


            {/* Email */}

            <div className="signup-form-group">

              <label htmlFor="signup-email">
                EMAIL
              </label>

              <div className="signup-input-wrapper">

                <span className="signup-input-icon">
                  ✉
                </span>

                <input
                  id="signup-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  autoComplete="email"
                />

              </div>

            </div>


            {/* Password */}

            <div className="signup-form-group">

              <label htmlFor="signup-password">
                PASSWORD
              </label>

              <div className="signup-input-wrapper signup-password-wrapper">

                <span className="signup-input-icon">
                  ♙
                </span>

                <input
                  id="signup-password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="new-password"
                />


                {/* Eye */}

                <button
                  type="button"
                  className="signup-password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >

                  {showPassword ? (

                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >

                      <path d="M3 3l18 18" />

                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />

                      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 10 8-0.6 1.6-1.6 3-2.9 4.2" />

                      <path d="M6.6 6.6C4.7 7.8 3.4 9.7 2 12c1.5 4 5 8 10 8 1 0 2-.2 2.9-.5" />

                    </svg>

                  ) : (

                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >

                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />

                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                      />

                    </svg>

                  )}

                </button>

              </div>

            </div>


            {/* Confirm Password */}

            <div className="signup-form-group">

              <label htmlFor="signup-confirm-password">
                CONFIRM PASSWORD
              </label>

              <div className="signup-input-wrapper signup-password-wrapper">

                <span className="signup-input-icon">
                  ✓
                </span>

                <input
                  id="signup-confirm-password"
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                />


                {/* Eye */}

                <button
                  type="button"
                  className="signup-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >

                  {showConfirmPassword ? (

                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >

                      <path d="M3 3l18 18" />

                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />

                      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 10 8-0.6 1.6-1.6 3-2.9 4.2" />

                      <path d="M6.6 6.6C4.7 7.8 3.4 9.7 2 12c1.5 4 5 8 10 8 1 0 2-.2 2.9-.5" />

                    </svg>

                  ) : (

                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >

                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />

                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                      />

                    </svg>

                  )}

                </button>

              </div>

            </div>


            {/* Error */}

            {error && (

              <p className="signup-form-error">
                {error}
              </p>

            )}


            {/* Success */}

            {success && (

              <p className="signup-form-success">
                {success}
              </p>

            )}


            {/* Create */}

            <button
              type="submit"
              className="signup-submit-button"
              disabled={loading}
            >

              {loading
                ? 'CREATING ACCOUNT...'
                : 'CREATE ACCOUNT →'}

            </button>

          </form>


          {/* =================================
              EMAIL VERIFICATION INFO
              ================================= */}

          {success && (

            <div className="signup-login-box">

              <div className="signup-login-text">

                <strong>
                  CHECK YOUR EMAIL
                </strong>

                <span>
                  Verify your email address before signing in.
                </span>

              </div>

            </div>

          )}


          {/* =================================
              DIVIDER
              ================================= */}

          <div className="signup-divider">

            <span />

            <strong>
              OR SIGN UP WITH
            </strong>

            <span />

          </div>


          {/* Google */}

          <button
            type="button"
            className="signup-oauth-button"
            onClick={handleGoogleSignup}
          >

            <svg
              className="signup-oauth-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >

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
              CONTINUE WITH GOOGLE
            </span>

            <b>→</b>

          </button>


          {/* GitHub */}

          <button
            type="button"
            className="signup-oauth-button"
            onClick={handleGithubSignup}
          >

            <svg
              className="signup-oauth-icon signup-github-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >

              <path
                fill="currentColor"
                d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.25c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.76.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5z"
              />

            </svg>

            <span>
              CONTINUE WITH GITHUB
            </span>

            <b>→</b>

          </button>


          {/* =================================
              LOGIN BOX
              ================================= */}

          <div className="signup-login-box">

            <div className="signup-login-text">

              <strong>
                ALREADY ON APTIVERSE?
              </strong>

              <span>
                Sign in and continue your journey.
              </span>

            </div>


            <a
              href="/login"
              className="signup-login-button"
            >
              SIGN IN →
            </a>

          </div>

        </section>

      </main>

    </div>
  )
}

export default Signup