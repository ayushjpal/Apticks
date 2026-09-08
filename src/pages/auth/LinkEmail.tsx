import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, RotateCw, AlertCircle, Shield } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { validatePassword } from '../../utils/validation'
import AuthShell from '../../components/auth/AuthShell'

export default function LinkEmail() {
  const navigate = useNavigate()
  const location = useLocation()

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
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          navigate('/login', { replace: true })
          return
        }

        const user = session.user
        const metaUsername = user.user_metadata?.username || user.email?.split('@')[0]
        if (!currentUsername && metaUsername) {
          setCurrentUsername(metaUsername)
        }

        if (user.new_email) {
          setSubmittedEmail(user.new_email)
        } else if (user.email && !user.is_anonymous) {
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
      <div className="min-h-screen bg-[#071a2b] flex items-center justify-center text-white">
        <div className="text-center font-display font-black">
          <div className="w-12 h-12 border-4 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-4" />
          <p>LOADING ACCOUNT...</p>
        </div>
      </div>
    )
  }

  const needsPasswordPrompt = !pendingPasswordFromState

  return (
    <AuthShell
      eyebrow="ACCOUNT SETUP"
      title={submittedEmail ? 'CHECK YOUR INBOX' : 'LINK REAL EMAIL'}
      subtitle={
        submittedEmail
          ? `Verification link sent to ${submittedEmail}. Confirm your email to enable password recovery.`
          : `Connect a real Gmail or personal email to ${
              currentUsername ? `@${currentUsername}` : 'your Apticks account'
            } for account recovery and official leaderboard verification.`
      }
      showBrandFeatures={false}
    >
      {/* Error notification */}
      {error && (
        <div className="mb-4 p-3 bg-[#fee2e2] border-2 border-[#0c1d2d] rounded-xl text-[#991b1b] font-display font-black text-xs shadow-[2.5px_2.5px_0_#000000] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#991b1b]" />
          <span>{error}</span>
        </div>
      )}

      {submittedEmail ? (
        <div className="space-y-4">
          <div className="p-4 bg-[#d1fae5] border-2 border-[#0c1d2d] rounded-xl shadow-[2.5px_2.5px_0_#000000]">
            <div className="flex items-center gap-2 font-display font-black text-xs text-[#065f46] uppercase mb-1">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>VERIFICATION PENDING</span>
            </div>
            <p className="text-xs font-body font-semibold text-black/80 leading-relaxed">
              Click the confirmation link sent to <strong>{submittedEmail}</strong> to link your email permanently.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3.5px_3.5px_0_#000000] font-display font-black text-sm tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center gap-2"
          >
            <span>CONTINUE TO DASHBOARD</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending}
            className="w-full py-2.5 bg-white hover:bg-[#f8fafc] border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>{resending ? 'RESENDING...' : 'RESEND VERIFICATION EMAIL'}</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleLinkEmail} className="space-y-4">
          {/* Email input */}
          <div>
            <label
              htmlFor="real-email"
              className="block mb-1 text-xs font-display font-black tracking-wider text-black uppercase"
            >
              REAL EMAIL / GMAIL
            </label>
            <div className="flex items-center bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] focus-within:shadow-[3px_3px_0_#38aef0] overflow-hidden transition-shadow">
              <span className="px-3.5 py-3 border-r-2 border-[#0c1d2d] bg-[#f1f5f9] text-black flex items-center">
                <Mail className="w-4 h-4 text-black" />
              </span>
              <input
                id="real-email"
                type="email"
                placeholder="yourname@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full py-3 px-3 outline-none font-display font-bold text-sm bg-transparent placeholder:text-black/35"
              />
            </div>
          </div>

          {/* Password Prompt if not cached */}
          {needsPasswordPrompt && (
            <div>
              <label
                htmlFor="confirm-pass"
                className="block mb-1 text-xs font-display font-black tracking-wider text-black uppercase"
              >
                CONFIRM PASSWORD
              </label>
              <div className="flex items-center bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] focus-within:shadow-[3px_3px_0_#38aef0] overflow-hidden transition-shadow">
                <span className="px-3.5 py-3 border-r-2 border-[#0c1d2d] bg-[#f1f5f9] text-black flex items-center">
                  <Lock className="w-4 h-4 text-black" />
                </span>
                <input
                  id="confirm-pass"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3.5px_3.5px_0_#000000] font-display font-black text-sm tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            <span>{loading ? 'SENDING LINK...' : 'SEND VERIFICATION LINK'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Security privacy note */}
      <div className="mt-6 p-3.5 bg-[#e9f6ff] border-2 border-[#0c1d2d] rounded-xl flex items-start gap-2.5">
        <Shield className="w-4 h-4 text-[#38aef0] shrink-0 mt-0.5" />
        <p className="text-xs font-body font-semibold text-black/80 leading-relaxed">
          Your real email is kept private and will never be shown publicly or shared with other players.
        </p>
      </div>
    </AuthShell>
  )
}
