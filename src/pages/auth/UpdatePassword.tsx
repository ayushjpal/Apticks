import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Lock, CheckCircle2, ArrowRight, ArrowLeft, AlertCircle, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AuthShell from '../../components/auth/AuthShell'

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
      }, 1200)
    } catch (error) {
      console.error('Unexpected password update error:', error)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const strengthScore =
    password.length >= 12 ? 4 : password.length >= 10 ? 3 : password.length >= 8 ? 2 : password.length > 0 ? 1 : 0

  return (
    <AuthShell
      eyebrow="ACCOUNT SECURITY"
      title="UPDATE PASSWORD"
      subtitle="Create a new secure password for your Apticks account."
      showBrandFeatures={false}
    >
      {/* Error notification */}
      {error && (
        <div className="mb-4 p-3 bg-[#fee2e2] border-2 border-[#0c1d2d] rounded-xl text-[#991b1b] font-display font-black text-xs shadow-[2.5px_2.5px_0_#000000] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#991b1b]" />
          <span>{error}</span>
        </div>
      )}

      {/* Success notification */}
      {success && (
        <div className="mb-4 p-3 bg-[#d1fae5] border-2 border-[#0c1d2d] rounded-xl text-[#065f46] font-display font-black text-xs shadow-[2.5px_2.5px_0_#000000] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div>
          <label
            htmlFor="password"
            className="block mb-1 text-xs font-display font-black tracking-wider text-black uppercase"
          >
            NEW PASSWORD
          </label>
          <div className="flex items-center bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] focus-within:shadow-[3px_3px_0_#38aef0] overflow-hidden transition-shadow">
            <span className="px-3.5 py-3 border-r-2 border-[#0c1d2d] bg-[#f1f5f9] text-black flex items-center">
              <Lock className="w-4 h-4 text-black" />
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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

          {/* Password strength meter */}
          <div className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4].map((lvl) => (
              <div
                key={lvl}
                className={`h-2 flex-1 rounded-full border-2 border-[#0c1d2d] ${
                  lvl <= strengthScore
                    ? strengthScore >= 3
                      ? 'bg-[#32e875]'
                      : 'bg-[#ffd43b]'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="block mb-1 text-xs font-display font-black tracking-wider text-black uppercase"
          >
            CONFIRM NEW PASSWORD
          </label>
          <div className="flex items-center bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] focus-within:shadow-[3px_3px_0_#38aef0] overflow-hidden transition-shadow">
            <span className="px-3.5 py-3 border-r-2 border-[#0c1d2d] bg-[#f1f5f9] text-black flex items-center">
              <ShieldCheck className="w-4 h-4 text-black" />
            </span>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full py-3 px-3 outline-none font-display font-bold text-sm bg-transparent placeholder:text-black/35"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              className="px-3 text-black/60 hover:text-black transition-colors cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3.5px_3.5px_0_#000000] font-display font-black text-sm tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
        >
          <span>{loading ? 'UPDATING...' : 'UPDATE PASSWORD'}</span>
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
    </AuthShell>
  )
}