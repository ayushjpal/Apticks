import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, CheckCircle2, XCircle, Loader2, ArrowRight, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ProfileService, type UsernameValidationResult } from '../../services/profileService'
import { normalizeUsername } from '../../utils/validation'
import AuthShell from '../../components/auth/AuthShell'

export default function ChooseUsername() {
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<UsernameValidationResult | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isMounted = true

    const checkUser = async () => {
      let activeUser: { id: string } | null = null

      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session?.user) {
        activeUser = sessionData.session.user
      } else {
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (!userError && userData?.user) {
          activeUser = userData.user
        }
      }

      if (!activeUser && isMounted) {
        navigate('/login', { replace: true })
        return
      }

      if (isMounted && activeUser) {
        setUserId(activeUser.id)
      }
    }

    checkUser()

    return () => {
      isMounted = false
    }
  }, [navigate])

  useEffect(() => {
    const clean = normalizeUsername(username)

    if (!clean) {
      return
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true)
      const result = await ProfileService.validateAndCheckUsername(clean, userId)
      setUsernameStatus(result)
      setCheckingUsername(false)
    }, 350)

    return () => {
      clearTimeout(timer)
    }
  }, [username, userId])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const cleanUsername = normalizeUsername(username)

    if (!cleanUsername) {
      setError('Please choose a username.')
      return
    }

    const validation = await ProfileService.validateAndCheckUsername(cleanUsername, userId)
    if (!validation.isValid) {
      setError(validation.message)
      return
    }

    if (!validation.isAvailable) {
      setError('This username is already taken.')
      return
    }

    setLoading(true)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('Your session has expired. Please login again.')
        navigate('/login', { replace: true })
        return
      }

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: cleanUsername,
          display_name: cleanUsername,
          updated_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle()

      if (upsertError) {
        console.error('Profile upsert error:', upsertError)
        if (upsertError.code === '23505') {
          setError('This username is already taken.')
        } else {
          setError('Unable to save username. Please try again.')
        }
        return
      }

      try {
        await supabase.auth.updateUser({
          data: {
            username: cleanUsername,
            display_name: cleanUsername,
          },
        })
      } catch (metaErr) {
        console.warn('Syncing user_metadata note:', metaErr)
      }

      setSuccess('Handle saved successfully! Entering arena...')

      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 600)
    } catch (err) {
      console.error('Choose username error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Onboarding"
      title="Choose Your Handle"
      subtitle="This username will identify you across all leaderboards, contests, and 1v1 arenas."
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
        <div>
          <label
            htmlFor="username"
            className="block mb-1.5 text-xs font-semibold tracking-wider text-slate-700 uppercase"
          >
            Username
          </label>
          <div className="flex items-center bg-white border border-slate-300 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden transition-all">
            <span className="px-3 py-2.5 border-r border-slate-200 bg-slate-50 text-slate-500 font-semibold text-xs flex items-center">
              <User className="w-3.5 h-3.5 text-slate-400 mr-1" />
              @
            </span>
            <input
              id="username"
              type="text"
              placeholder="e.g. quantum_coder"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                if (!e.target.value.trim()) {
                  setUsernameStatus(null)
                }
              }}
              maxLength={20}
              autoComplete="username"
              autoFocus
              className="w-full py-2.5 px-3 outline-none font-medium text-sm bg-transparent placeholder:text-slate-400 text-slate-900"
            />
          </div>

          {/* Real-time username feedback pill */}
          {username.trim() && (
            <div className="mt-2">
              {checkingUsername ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 font-medium text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>Checking availability...</span>
                </div>
              ) : usernameStatus ? (
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg font-medium text-xs ${
                    !usernameStatus.isValid
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : usernameStatus.isAvailable
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {!usernameStatus.isValid ? (
                    <>
                      <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>{usernameStatus.message}</span>
                    </>
                  ) : usernameStatus.isAvailable ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span>Username is available!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                      <span>Username is taken</span>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <p className="mt-1.5 text-[11px] text-slate-500 font-medium">
            3–20 characters • letters, numbers, _, -, .
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || checkingUsername || (Boolean(username.trim()) && usernameStatus !== null && !usernameStatus.isAvailable)}
          className="w-full py-2.5 sm:py-3 bg-[#ffd43b] hover:bg-[#fcc419] text-[#0c1d2d] border border-amber-400/60 rounded-xl font-semibold text-sm shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
        >
          <span>{loading ? 'Saving...' : 'Continue to Arena'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Info notice */}
      <div className="mt-6 p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-2.5 text-xs text-sky-900 leading-relaxed">
        <span className="font-semibold text-xs text-sky-600">ℹ</span>
        <p>
          You can customize your bio and avatar picture anytime later from your Profile settings.
        </p>
      </div>
    </AuthShell>
  )
}