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
      eyebrow="Account Security"
      title="Update Password"
      subtitle="Create a new secure password for your Apticks account."
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
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div>
          <label
            htmlFor="password"
            className="block mb-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase"
          >
            New Password
          </label>
          <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden transition-all">
            <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-slate-400 flex items-center">
              <Lock className="w-4 h-4 text-slate-400" />
            </span>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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

          {/* Password strength meter */}
          <div className="mt-2 flex gap-1.5">
            {[1, 2, 3, 4].map((lvl) => (
              <div
                key={lvl}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  lvl <= strengthScore
                    ? strengthScore >= 3
                      ? 'bg-emerald-500'
                      : strengthScore === 2
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
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
            className="block mb-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase"
          >
            Confirm New Password
          </label>
          <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden transition-all">
            <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-slate-400 flex items-center">
              <ShieldCheck className="w-4 h-4 text-slate-400" />
            </span>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full py-2.5 px-3 outline-none font-medium text-sm bg-transparent placeholder:text-slate-400 text-slate-900"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              className="px-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 sm:py-3 bg-[#ffd43b] hover:bg-[#fcc419] text-[#0c1d2d] border border-amber-400/60 rounded-xl font-semibold text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
        >
          <span>{loading ? 'Updating...' : 'Update Password'}</span>
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
    </AuthShell>
  )
}