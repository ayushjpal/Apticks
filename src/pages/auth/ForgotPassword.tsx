import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowRight, ArrowLeft, HelpCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AuthBackground from '../../components/auth/AuthBackground'
import AuthInput from '../../components/auth/AuthInput'
import AuthPrimaryButton from '../../components/auth/AuthPrimaryButton'
import AuthAlert from '../../components/auth/AuthAlert'

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
    <AuthBackground
      variant="forgot"
      navRight={
        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
          <span className="hidden sm:inline">Remember your password?</span>
          <Link
            to="/login"
            className="font-display font-semibold text-[#ffd43b] hover:text-[#facc15] transition-colors inline-flex items-center gap-1"
          >
            <span>Sign in</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      }
    >
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        {/* ======================================================= */}
        {/* LEFT: EDITORIAL SECTION                                 */}
        {/* ======================================================= */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="font-mono text-xs sm:text-sm tracking-[0.25em] text-[#ffd43b]/90 font-bold uppercase mb-3">
            03
          </div>
          <div className="w-12 sm:w-16 h-px bg-slate-700/80 mb-6 sm:mb-8" />
          <h1 className="font-display font-extrabold text-4xl sm:text-6xl lg:text-7xl text-white tracking-tight leading-[1.05]">
            Recover<br />
            <span className="text-[#ffd43b]">Access.</span>
          </h1>
          <p className="font-display text-base sm:text-lg font-semibold text-slate-200 mt-6 sm:mt-8 leading-relaxed max-w-md">
            Enter your username or verified email to receive a reset link.
          </p>
        </div>

        {/* ======================================================= */}
        {/* RIGHT: RECOVERY CARD                                    */}
        {/* ======================================================= */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-[450px] bg-[#0c1d2d] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Top Subtle Amber/Cyan Line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

            {/* Central Recovery Visual: Envelope inside concentric circular geometry */}
            <div className="flex justify-center mb-6">
              <div className="relative w-24 h-24 flex items-center justify-center">
                {/* Outermost circle */}
                <div className="absolute inset-0 rounded-full border border-slate-700/50" />
                {/* Middle circle */}
                <div className="absolute inset-3 rounded-full border border-sky-400/25 bg-sky-500/[0.03]" />
                {/* Inner circle */}
                <div className="absolute inset-6 rounded-full border border-amber-400/20" />
                {/* Center icon badge */}
                <div className="w-10 h-10 rounded-xl bg-[#071a2b] border border-sky-400/40 flex items-center justify-center text-[#ffd43b] shadow-inner relative z-10">
                  <Mail className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {error && <AuthAlert type="error" message={error} className="mb-4" />}

            {/* Success State Visual */}
            {success ? (
              <div className="space-y-5">
                <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl">
                  <div className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                    CHECK YOUR EMAIL
                  </div>
                  <p className="font-sans text-xs text-slate-300 leading-relaxed">
                    {success}
                  </p>
                </div>

                <div className="pt-2">
                  <Link
                    to="/login"
                    className="w-full py-3.5 px-5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-display font-bold text-sm tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <span>Back to Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              /* Reset Request Form */
              <form onSubmit={handleResetPassword} className="space-y-4">
                <AuthInput
                  id="forgot-identifier"
                  label="USERNAME OR EMAIL"
                  icon={<Mail className="w-3.5 h-3.5" />}
                  prefixText="@"
                  placeholder="e.g. your_username or you@gmail.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />

                <div className="pt-2">
                  <AuthPrimaryButton
                    type="submit"
                    disabled={loading}
                    loading={loading}
                    loadingText="Sending Link..."
                  >
                    Send Reset Link
                  </AuthPrimaryButton>
                </div>
              </form>
            )}

            {/* Secondary Action: Back to sign in */}
            {!success && (
              <div className="mt-6 flex justify-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to sign in</span>
                </Link>
              </div>
            )}

            {/* Informative Security Guidance Note */}
            <div className="mt-6 p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
              <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <p>
                For accounts without a linked email, sign in using your username and password, then add a recovery email inside Profile settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthBackground>
  )
}