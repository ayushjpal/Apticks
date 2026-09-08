import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AuthShell from '../../components/auth/AuthShell'

export default function ForgotPassword() {
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
      const { data, error: fnError } = await supabase.functions.invoke('request-password-reset', {
        body: { identifier: cleanInput },
      })

      if (data?.unverified) {
        setError(data.message || 'Add and verify an email from your Profile to enable account recovery.')
        return
      }

      if (fnError) {
        if (
          cleanInput.includes('@') &&
          !cleanInput.endsWith('@apticks.app') &&
          !cleanInput.endsWith('@auth.apticks.internal') &&
          !cleanInput.endsWith('@aptiverse.local')
        ) {
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
    <AuthShell
      eyebrow="Account Recovery"
      title="Forgot Password?"
      subtitle="Enter your username or verified email connected to your Apticks account to receive a reset link."
      showBrandFeatures={false}
    >
      {/* Error notification */}
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Success notification */}
      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleResetPassword} className="space-y-4">
        <div>
          <label
            htmlFor="forgot-identifier"
            className="block mb-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase"
          >
            Username or Email
          </label>
          <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden transition-all">
            <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-slate-500 font-semibold text-xs flex items-center">
              <Mail className="w-3.5 h-3.5 text-slate-400 mr-1" />
              @
            </span>
            <input
              id="forgot-identifier"
              type="text"
              placeholder="e.g. your_username or you@gmail.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              autoFocus
              className="w-full py-2.5 px-3 outline-none font-medium text-sm bg-transparent placeholder:text-slate-400 text-slate-900"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 sm:py-3 bg-[#ffd43b] hover:bg-[#fcc419] text-[#0c1d2d] border border-amber-400/60 rounded-xl font-semibold text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
        >
          <span>{loading ? 'Sending Link...' : 'Send Reset Link'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Back to Sign In */}
      <div className="mt-6 flex justify-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#0c1d2d] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to sign in</span>
        </Link>
      </div>

      {/* Help info note */}
      <div className="mt-6 p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2.5 text-xs text-sky-900 leading-relaxed">
        <HelpCircle className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
        <p>
          For accounts without a linked email, sign in using your username and password, then add a recovery email inside Profile settings.
        </p>
      </div>
    </AuthShell>
  )
}