import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Lock, ShieldCheck, ArrowLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AuthBackground from '../../components/auth/AuthBackground'
import AuthInput from '../../components/auth/AuthInput'
import AuthPrimaryButton from '../../components/auth/AuthPrimaryButton'
import AuthAlert from '../../components/auth/AuthAlert'

export default function UpdatePassword() {
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!password) {
      setError('Please enter a new password.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        console.error('Password update error:', updateError)
        setError(updateError.message || 'Unable to update password. Please try again.')
        return
      }

      setSuccess('Password updated successfully!')

      setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: {
            message: 'Password updated successfully. Please sign in.',
          },
        })
      }, 1400)
    } catch (err) {
      console.error('Unexpected password update error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const strengthScore =
    password.length >= 12
      ? 4
      : password.length >= 10
      ? 3
      : password.length >= 8
      ? 2
      : password.length > 0
      ? 1
      : 0

  const strengthLabels = ['Enter password', 'Weak', 'Fair', 'Strong', 'Excellent']

  return (
    <AuthBackground
      variant="update"
      navRight={
        <Link
          to="/login"
          className="font-display font-semibold text-[#ffd43b] hover:text-[#facc15] transition-colors inline-flex items-center gap-1 font-mono text-xs"
        >
          <span>Back to sign in</span>
          <span aria-hidden="true">→</span>
        </Link>
      }
    >
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* ======================================================= */}
        {/* LEFT: EDITORIAL SECTION                                 */}
        {/* ======================================================= */}
        <div className="lg:col-span-4 flex flex-col justify-start pt-1">
          <div className="font-mono text-xs sm:text-sm tracking-[0.25em] text-[#ffd43b]/90 font-bold uppercase mb-3">
            04
          </div>
          <div className="w-12 sm:w-16 h-px bg-slate-700/80 mb-6 sm:mb-8" />
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.05]">
            Secure<br />
            Your<br />
            <span className="text-[#ffd43b]">Account.</span>
          </h1>
          <p className="font-display text-base sm:text-lg font-semibold text-slate-200 mt-6 sm:mt-8 leading-relaxed">
            Create a new secure password<br className="hidden sm:inline" />
            for your Apticks account.
          </p>
        </div>

        {/* ======================================================= */}
        {/* CENTER: PASSWORD FORM CARD                              */}
        {/* ======================================================= */}
        <div className="lg:col-span-5 bg-[#0c1d2d] border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
          {/* Top Emerald/Cyan Line */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

          {/* Error Alert */}
          {error && <AuthAlert type="error" message={error} className="mb-4" />}

          {/* Success State */}
          {success ? (
            <div className="space-y-5 py-2">
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-xl">
                <div className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                  PASSWORD UPDATED
                </div>
                <p className="font-sans text-xs text-slate-300 leading-relaxed">
                  Your account is secure. Redirecting you to sign in...
                </p>
              </div>

              <Link
                to="/login"
                className="w-full py-3.5 px-5 bg-[#ffd43b] hover:bg-[#facc15] text-[#071a2b] font-display font-bold text-sm tracking-wider uppercase rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <span>Continue to Sign In →</span>
              </Link>
            </div>
          ) : (
            /* Update Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New Password */}
              <div>
                <AuthInput
                  id="password"
                  label="NEW PASSWORD"
                  type={showPassword ? 'text' : 'password'}
                  icon={<Lock className="w-3.5 h-3.5" />}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  action={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                {/* Password Strength Meter */}
                <div className="mt-2.5">
                  <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-1">
                    <span>STRENGTH</span>
                    <span
                      className={
                        strengthScore >= 3
                          ? 'text-emerald-400 font-bold'
                          : strengthScore === 2
                          ? 'text-[#ffd43b] font-bold'
                          : strengthScore === 1
                          ? 'text-rose-400'
                          : 'text-slate-500'
                      }
                    >
                      {strengthLabels[strengthScore]}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((lvl) => (
                      <div
                        key={lvl}
                        className={`h-1 rounded-full transition-colors ${
                          lvl <= strengthScore
                            ? strengthScore >= 3
                              ? 'bg-emerald-400'
                              : strengthScore === 2
                              ? 'bg-[#ffd43b]'
                              : 'bg-rose-400'
                            : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <AuthInput
                id="confirmPassword"
                label="CONFIRM PASSWORD"
                type={showConfirmPassword ? 'text' : 'password'}
                icon={<Lock className="w-3.5 h-3.5" />}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                action={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />

              {/* Submit CTA */}
              <div className="pt-2">
                <AuthPrimaryButton
                  type="submit"
                  disabled={loading}
                  loading={loading}
                  loadingText="Updating..."
                >
                  Update Password
                </AuthPrimaryButton>
              </div>
            </form>
          )}

          {/* Secondary Action */}
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
        </div>

        {/* ======================================================= */}
        {/* RIGHT: COMPACT SECURITY PANEL                           */}
        {/* ======================================================= */}
        <aside className="lg:col-span-3 w-full">
          <div className="bg-[#0c1d2d]/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
            {/* Subtle top emerald line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

            {/* Shield + Lock Visual */}
            <div className="flex items-center justify-center my-4">
              <div className="relative w-20 h-20 rounded-2xl bg-[#071a2b] border border-slate-700/60 flex items-center justify-center text-emerald-400 shadow-inner">
                <div className="absolute inset-1 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.03]" />
                <div className="relative flex items-center justify-center">
                  <ShieldCheck className="w-9 h-9 text-emerald-400 stroke-[1.75]" />
                  <Lock className="w-4 h-4 text-[#ffd43b] absolute bottom-0.5 right-0.5" />
                </div>
              </div>
            </div>

            {/* Panel Title */}
            <div className="text-center pt-2 pb-1">
              <div className="font-mono text-xs font-bold tracking-widest text-white uppercase">
                ACCOUNT
              </div>
              <div className="font-mono text-xs font-bold tracking-widest text-[#ffd43b] uppercase mt-0.5">
                SECURITY
              </div>
            </div>

            {/* Editorial statement */}
            <div className="mt-4 pt-4 border-t border-slate-800/80 text-center font-mono text-[10px] tracking-wider text-slate-400 leading-relaxed uppercase">
              PROTECTS<br />
              YOUR PROGRESS<br />
              IN THE ARENA.
            </div>
          </div>
        </aside>
      </div>
    </AuthBackground>
  )
}