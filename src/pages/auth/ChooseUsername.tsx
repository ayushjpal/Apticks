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
      eyebrow="ONBOARDING // HANDLE"
      title="CHOOSE YOUR HANDLE"
      subtitle="This username will identify you across all leaderboards, contests, and 1v1 arenas."
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
        <div>
          <label
            htmlFor="username"
            className="block mb-1 text-xs font-display font-black tracking-wider text-black uppercase"
          >
            USERNAME
          </label>
          <div className="flex items-center bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] focus-within:shadow-[3px_3px_0_#38aef0] overflow-hidden transition-shadow">
            <span className="px-3.5 py-3 border-r-2 border-[#0c1d2d] bg-[#f1f5f9] text-black font-display font-black text-sm flex items-center">
              <User className="w-4 h-4 text-black mr-1" />
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
              className="w-full py-3 px-3 outline-none font-display font-bold text-sm bg-transparent placeholder:text-black/35"
            />
          </div>

          {/* Real-time username feedback pill */}
          {username.trim() && (
            <div className="mt-2">
              {checkingUsername ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#fef3c7] border-2 border-[#0c1d2d] rounded-full font-display font-bold text-xs shadow-[1.5px_1.5px_0_#0c1d2d]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking availability...</span>
                </div>
              ) : usernameStatus ? (
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 border-2 border-[#0c1d2d] rounded-full font-display font-bold text-xs shadow-[1.5px_1.5px_0_#0c1d2d] ${
                    !usernameStatus.isValid
                      ? 'bg-[#fee2e2] text-[#991b1b]'
                      : usernameStatus.isAvailable
                      ? 'bg-[#d1fae5] text-[#065f46]'
                      : 'bg-[#fee2e2] text-[#991b1b]'
                  }`}
                >
                  {!usernameStatus.isValid ? (
                    <>
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{usernameStatus.message}</span>
                    </>
                  ) : usernameStatus.isAvailable ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Username is available!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Username is taken</span>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <p className="mt-1 font-mono text-[10px] text-black/60 font-semibold">
            3–20 characters • letters, numbers, _, -, .
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || checkingUsername || (Boolean(username.trim()) && usernameStatus !== null && !usernameStatus.isAvailable)}
          className="w-full py-3.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3.5px_3.5px_0_#000000] font-display font-black text-sm tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
        >
          <span>{loading ? 'SAVING...' : 'CONTINUE TO ARENA'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Info notice */}
      <div className="mt-6 p-3.5 bg-[#e9f6ff] border-2 border-[#0c1d2d] rounded-xl flex items-start gap-2.5">
        <span className="font-mono font-black text-xs text-[#38aef0]">ℹ</span>
        <p className="text-xs font-body font-semibold text-black/80 leading-relaxed">
          You can customize your bio and avatar picture anytime later from your Profile settings.
        </p>
      </div>
    </AuthShell>
  )
}