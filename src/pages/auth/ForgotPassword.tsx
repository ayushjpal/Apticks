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
      eyebrow="ACCOUNT RECOVERY"
      title="FORGOT PASSWORD?"
      subtitle="Enter your username or verified email connected to your Apticks account to receive a reset link."
      showBrandFeatures={false}
    >
      {/* Error notification */}
      {error && (
        <div className="mb-4 p-3 bg-[#fee2e2] border-2 border-black rounded-xl text-[#991b1b] font-display font-black text-xs shadow-[2.5px_2.5px_0_#000000] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#991b1b]" />
          <span>{error}</span>
        </div>
      )}

      {/* Success notification */}
      {success && (
        <div className="mb-4 p-3 bg-[#d1fae5] border-2 border-black rounded-xl text-[#065f46] font-display font-black text-xs shadow-[2.5px_2.5px_0_#000000] flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleResetPassword} className="space-y-4">
        <div>
          <label
            htmlFor="forgot-identifier"
            className="block mb-1 text-xs font-display font-black tracking-wider text-black uppercase"
          >
            USERNAME OR EMAIL
          </label>
          <div className="flex items-center bg-white border-2 sm:border-3 border-black rounded-xl shadow-[3px_3px_0_#000000] focus-within:shadow-[3px_3px_0_#38aef0] overflow-hidden transition-shadow">
            <span className="px-3.5 py-3 border-r-2 border-black bg-[#f1f5f9] text-black font-display font-black text-sm flex items-center">
              <Mail className="w-4 h-4 text-black mr-1" />
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
              className="w-full py-3 px-3 outline-none font-display font-bold text-sm bg-transparent placeholder:text-black/35"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 sm:border-3 border-black rounded-xl shadow-[3.5px_3.5px_0_#000000] font-display font-black text-sm tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
        >
          <span>{loading ? 'SENDING LINK...' : 'SEND RESET LINK'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Back to Sign In */}
      <div className="mt-6 flex justify-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-xs font-display font-black text-black hover:text-[#2563eb] uppercase tracking-wider underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>BACK TO SIGN IN</span>
        </Link>
      </div>

      {/* Help info note */}
      <div className="mt-6 p-3.5 bg-[#e9f6ff] border-2 border-black rounded-xl flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-[#38aef0] shrink-0 mt-0.5" />
        <p className="text-xs font-body font-semibold text-black/80 leading-relaxed">
          For accounts without a linked email, sign in using your username and password, then add a recovery email inside Profile settings.
        </p>
      </div>
    </AuthShell>
  )
}