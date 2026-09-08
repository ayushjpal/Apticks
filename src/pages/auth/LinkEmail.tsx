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
        <div className="text-center font-medium">
          <div className="w-8 h-8 border-2 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading account...</p>
        </div>
      </div>
    )
  }

  const needsPasswordPrompt = !pendingPasswordFromState

  return (
    <AuthShell
      eyebrow="Account Setup"
      title={submittedEmail ? 'Check Your Inbox' : 'Link Real Email'}
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
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {submittedEmail ? (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2 font-semibold text-xs text-emerald-800 uppercase mb-1">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Verification Pending</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Click the confirmation link sent to <strong>{submittedEmail}</strong> to link your email permanently.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 sm:py-3 bg-[#ffd43b] hover:bg-[#fcc419] text-[#0c1d2d] border border-amber-400/60 rounded-xl font-semibold text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Continue to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResendVerification}
            disabled={resending}
            className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs text-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            <span>{resending ? 'Resending...' : 'Resend Verification Email'}</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleLinkEmail} className="space-y-4">
          {/* Email input */}
          <div>
            <label
              htmlFor="real-email"
              className="block mb-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase"
            >
              Real Email / Gmail
            </label>
            <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden transition-all">
              <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-slate-400 flex items-center">
                <Mail className="w-4 h-4 text-slate-400" />
              </span>
              <input
                id="real-email"
                type="email"
                placeholder="yourname@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full py-2.5 px-3 outline-none font-medium text-sm bg-transparent placeholder:text-slate-400 text-slate-900"
              />
            </div>
          </div>

          {/* Password Prompt if not cached */}
          {needsPasswordPrompt && (
            <div>
              <label
                htmlFor="confirm-pass"
                className="block mb-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase"
              >
                Confirm Password
              </label>
              <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden transition-all">
                <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-slate-400 flex items-center">
                  <Lock className="w-4 h-4 text-slate-400" />
                </span>
                <input
                  id="confirm-pass"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 sm:py-3 bg-[#ffd43b] hover:bg-[#fcc419] text-[#0c1d2d] border border-amber-400/60 rounded-xl font-semibold text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
          >
            <span>{loading ? 'Sending Link...' : 'Send Verification Link'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      )}

      {/* Security privacy note */}
      <div className="mt-6 p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2.5 text-xs text-sky-900 leading-relaxed">
        <Shield className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
        <p>
          Your real email is kept private and will never be shown publicly or shared with other players.
        </p>
      </div>
    </AuthShell>
  )
}
