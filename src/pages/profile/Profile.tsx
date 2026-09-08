import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  User,
  Shield,
  Mail,
  KeyRound,
  LogOut,
  Upload,
  Trophy,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCw,
  Sparkles,
  Lock,
  ArrowRight,
  Flame,
  Settings,
  Sliders,
  Award,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  ProfileService,
  type UserProfile,
  type UsernameCooldownInfo,
} from '../../services/profileService'
import { normalizeUsername } from '../../utils/validation'
import { QuestionService } from '../../services/questionService'
import { StreakService } from '../../services/streakService'
import type { QuestionBankStats, UserQuestionAttempt, UserStreak } from '../../types/questions'
import AppLayout from '../../components/layout/AppLayout'

// Curated avatar presets
const AVATAR_PRESETS = [
  {
    id: 'p1',
    label: 'Cyber Amber',
    url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=AptiCyber&backgroundColor=ffd43b',
  },
  {
    id: 'p2',
    label: 'Apex Blue',
    url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=MatrixHero&backgroundColor=38aef0',
  },
  {
    id: 'p3',
    label: 'Neon Emerald',
    url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=SpeedAce&backgroundColor=32e875',
  },
  {
    id: 'p4',
    label: 'Turbo Crimson',
    url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=QuantumPulse&backgroundColor=ff5b5b',
  },
  {
    id: 'p5',
    label: 'Vortex Purple',
    url: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=SigmaChallenger&backgroundColor=c084fc',
  },
]

export default function Profile() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Active View Tab: 'overview' | 'edit' | 'settings'
  const [activeTab, setActiveTab] = useState<'overview' | 'edit' | 'settings'>('overview')

  // User & DB State
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Original Profile data
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null)
  const [questionStats, setQuestionStats] = useState<QuestionBankStats | null>(null)
  const [userAttempts, setUserAttempts] = useState<UserQuestionAttempt[]>([])
  const [userStreak, setUserStreak] = useState<UserStreak | null>(null)

  // Form Fields
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [usernameInput, setUsernameInput] = useState('')

  // Email Linking Modal & OTP State
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailModalError, setEmailModalError] = useState<string | null>(null)
  const [emailModalSuccess, setEmailModalSuccess] = useState<string | null>(null)

  // Username Availability & Cooldown State
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<{
    available: boolean
    isCurrent: boolean
    message: string
  } | null>(null)
  const [cooldown, setCooldown] = useState<UsernameCooldownInfo>({
    canChange: true,
    daysLeft: 0,
    nextChangeDate: null,
    formattedNextChangeDate: null,
  })

  // ---------------------------------------------------------------------------
  // 1. Initial Load
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      setLoading(true)
      try {
        let user: { id: string; email?: string; email_confirmed_at?: string; user_metadata?: Record<string, unknown> } | null = null

        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData?.session?.user) {
          user = sessionData.session.user
        } else {
          const {
            data: { user: fetchedUser },
            error: authError,
          } = await supabase.auth.getUser()

          if (!authError && fetchedUser) {
            user = fetchedUser
          }
        }

        if (!user) {
          if (isMounted) {
            navigate('/login', { replace: true })
          }
          return
        }

        if (!isMounted) return

        setUserId(user.id)

        const rawEmail = user.email || ''
        const isInternal =
          !rawEmail ||
          rawEmail.endsWith('@apticks.app') ||
          rawEmail.endsWith('@auth.apticks.internal') ||
          rawEmail.endsWith('@aptiverse.local')

        const verified = !isInternal && Boolean(user.email_confirmed_at)
        setIsEmailVerified(verified)
        setUserEmail(verified ? rawEmail : null)

        let profile = await ProfileService.fetchProfile(user.id)
        const metaUsername = typeof user.user_metadata?.username === 'string' ? user.user_metadata.username : null
        const metaDisplayName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : metaUsername
        if (!profile?.username && metaUsername) {
          profile = {
            id: user.id,
            username: metaUsername,
            display_name: metaDisplayName,
            avatar_url: profile?.avatar_url || null,
            bio: profile?.bio || null,
            username_changed_at: profile?.username_changed_at || null,
          }
        }

        if (isMounted) {
          setOriginalProfile(profile)
          setDisplayName(profile?.display_name || '')
          setBio(profile?.bio || '')
          setAvatarUrl(profile?.avatar_url || null)
          setUsernameInput(profile?.username || '')

          const coolInfo = ProfileService.getUsernameCooldownInfo(
            profile?.username_changed_at
          )
          setCooldown(coolInfo)

          if (profile?.username) {
            setUsernameStatus({
              available: false,
              isCurrent: true,
              message: 'Current handle.',
            })
          }
        }

        try {
          const [{ questions, progressMap, challengeBonusXp }, attempts, streak] = await Promise.all([
            QuestionService.getQuestionsWithProgress(user.id),
            QuestionService.getUserAttempts(user.id, 20),
            StreakService.getUserStreak(user.id),
          ])
          const stats = QuestionService.calculateStats(questions, progressMap, attempts, challengeBonusXp)
          if (isMounted) {
            setQuestionStats(stats)
            setUserAttempts(attempts)
            setUserStreak(streak)
          }
        } catch (qErr) {
          console.warn('Could not load profile question stats/streak:', qErr)
        }
      } catch (err: unknown) {
        console.error('Error loading profile page:', err)
        if (isMounted) {
          setErrorMessage('Could not load profile details. Please refresh.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [navigate])

  // ---------------------------------------------------------------------------
  // 2. Debounced Username Live Availability Check
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!userId || loading) return

    const trimmed = normalizeUsername(usernameInput)

    const timeoutId = setTimeout(async () => {
      if (!trimmed) {
        setUsernameStatus({
          available: false,
          isCurrent: false,
          message: 'Username cannot be empty',
        })
        return
      }

      if (
        originalProfile?.username &&
        trimmed === normalizeUsername(originalProfile.username)
      ) {
        setUsernameStatus({
          available: false,
          isCurrent: true,
          message: 'Current handle.',
        })
        return
      }

      if (!cooldown.canChange) {
        return
      }

      setCheckingUsername(true)
      const result = await ProfileService.validateAndCheckUsername(
        trimmed,
        userId,
        originalProfile?.username
      )

      setUsernameStatus({
        available: result.isAvailable,
        isCurrent: result.isCurrent,
        message: result.message,
      })
      setCheckingUsername(false)
    }, 400)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [usernameInput, userId, originalProfile, cooldown.canChange, loading])

  // ---------------------------------------------------------------------------
  // 3. Avatar Upload Handler
  // ---------------------------------------------------------------------------
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return

    setUploadingAvatar(true)
    setErrorMessage(null)

    try {
      const { url, error } = await ProfileService.uploadAvatar(userId, file)
      if (error || !url) {
        setErrorMessage(error || 'Failed to process image.')
      } else {
        setAvatarUrl(url)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error uploading profile picture.'
      setErrorMessage(msg)
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSelectPresetAvatar = (presetUrl: string) => {
    setAvatarUrl(presetUrl)
    setErrorMessage(null)
  }

  const handleRemoveAvatar = () => {
    setAvatarUrl(null)
  }

  // ---------------------------------------------------------------------------
  // 4. Save Profile
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    setSaving(true)
    setErrorMessage(null)
    setSaveSuccess(false)

    const isChangingUsername =
      normalizeUsername(usernameInput) !==
      normalizeUsername(originalProfile?.username || '')

    if (isChangingUsername && !cooldown.canChange) {
      setErrorMessage(
        `Username can only be changed once every 14 days. Next change available on ${cooldown.formattedNextChangeDate}.`
      )
      setSaving(false)
      return
    }

    if (isChangingUsername && (!usernameStatus?.available || checkingUsername)) {
      setErrorMessage(usernameStatus?.message || 'Please choose a valid available username.')
      setSaving(false)
      return
    }

    try {
      const res = await ProfileService.updateProfile(userId, {
        displayName,
        bio,
        avatarUrl,
        newUsername: isChangingUsername ? usernameInput : undefined,
        currentUsername: originalProfile?.username,
        currentUsernameChangedAt: originalProfile?.username_changed_at,
      })

      if (!res.success || !res.profile) {
        setErrorMessage(res.error || 'Failed to update profile.')
      } else {
        setOriginalProfile(res.profile)
        setSaveSuccess(true)

        if (isChangingUsername) {
          const newCooldown = ProfileService.getUsernameCooldownInfo(
            res.profile.username_changed_at
          )
          setCooldown(newCooldown)
        }

        setTimeout(() => {
          setSaveSuccess(false)
        }, 4000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error while updating profile.'
      setErrorMessage(msg)
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 5. In-App OTP Email Linking Handlers
  // ---------------------------------------------------------------------------
  const handleInitiateEmailLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailModalError(null)
    setEmailModalSuccess(null)

    const clean = emailInput.trim().toLowerCase()
    if (!clean) {
      setEmailModalError('Please enter an email address.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(clean)) {
      setEmailModalError('Please enter a valid email address.')
      return
    }

    if (
      clean.endsWith('@apticks.app') ||
      clean.endsWith('@auth.apticks.internal') ||
      clean.endsWith('@aptiverse.local')
    ) {
      setEmailModalError('Please enter a real email address (e.g. Gmail).')
      return
    }

    setEmailLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: clean,
      })

      if (updateError) {
        setEmailModalError(updateError.message || 'Failed to initiate email update.')
        return
      }

      setOtpStep(true)
      setEmailModalSuccess(`Verification code sent to ${clean}. Enter the 6-digit code below.`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setEmailModalError(msg)
    } finally {
      setEmailLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailModalError(null)
    setEmailModalSuccess(null)

    const cleanEmail = emailInput.trim().toLowerCase()
    const cleanToken = otpCode.trim()

    if (!cleanToken || cleanToken.length < 6) {
      setEmailModalError('Please enter the full 6-digit verification code.')
      return
    }

    setEmailLoading(true)
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email_change',
      })

      if (verifyError) {
        setEmailModalError(verifyError.message || 'Invalid or expired verification code.')
        return
      }

      setUserEmail(cleanEmail)
      setIsEmailVerified(true)
      setEmailModalSuccess('Email verified and linked successfully!')

      setTimeout(() => {
        setEmailModalOpen(false)
        setOtpStep(false)
        setEmailInput('')
        setOtpCode('')
        setEmailModalSuccess(null)
      }, 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed.'
      setEmailModalError(msg)
    } finally {
      setEmailLoading(false)
    }
  }

  const handleResendOtp = async () => {
    const cleanEmail = emailInput.trim().toLowerCase()
    if (!cleanEmail) return

    setEmailModalError(null)
    setEmailLoading(true)
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'email_change',
        email: cleanEmail,
      })

      if (resendError) {
        setEmailModalError(resendError.message || 'Failed to resend code.')
      } else {
        setEmailModalSuccess(`New verification code sent to ${cleanEmail}.`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resend verification code.'
      setEmailModalError(msg)
    } finally {
      setEmailLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Logout Handler
  // ---------------------------------------------------------------------------
  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Logout error:', err)
      setLoggingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1d2d] flex items-center justify-center text-white">
        <div className="text-center font-display font-black">
          <div className="w-12 h-12 border-2 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-4" />
          <p className="tracking-wider">LOADING PROFILE...</p>
        </div>
      </div>
    )
  }

  const effectiveDisplayName =
    displayName.trim() ||
    originalProfile?.display_name ||
    originalProfile?.username ||
    'Player'

  const effectiveUsername =
    usernameInput.trim() ||
    originalProfile?.username ||
    'player'

  const firstLetter = effectiveDisplayName.charAt(0).toUpperCase()

  return (
    <AppLayout>
      <div className="max-w-[1160px] mx-auto space-y-4 sm:space-y-5 animate-entry">
        {/* Success Alert */}
        {saveSuccess && (
          <div className="p-3.5 bg-[#d1fae5] border-2 border-[#0c1d2d] rounded-xl text-[#065f46] shadow-[2px_2px_0_#0c1d2d] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-display font-black text-xs sm:text-sm uppercase">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#065f46]" />
              <span>PROFILE CHANGES SAVED SUCCESSFULLY</span>
            </div>
            <button
              onClick={() => setSaveSuccess(false)}
              className="text-[11px] font-mono font-black underline cursor-pointer"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-[#fee2e2] border-2 border-[#0c1d2d] rounded-xl text-[#991b1b] shadow-[2px_2px_0_#0c1d2d] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-display font-black text-xs sm:text-sm uppercase">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#991b1b]" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-[11px] font-mono font-black underline cursor-pointer"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* ================================================= */}
        {/* TOP TABBED NAVIGATION CONTROLS                    */}
        {/* ================================================= */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`
              px-3.5 py-2 rounded-xl border-2 border-[#0c1d2d] font-display font-black text-[11px] sm:text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5
              ${
                activeTab === 'overview'
                  ? 'bg-[#ffd43b] text-black shadow-[2px_2px_0_#0c1d2d] -translate-y-0.5'
                  : 'bg-white text-black/80 hover:bg-[#e9f6ff] shadow-[1.5px_1.5px_0_#0c1d2d]'
              }
            `}
          >
            <User className="w-3.5 h-3.5" />
            <span>OVERVIEW</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`
              px-3.5 py-2 rounded-xl border-2 border-[#0c1d2d] font-display font-black text-[11px] sm:text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5
              ${
                activeTab === 'edit'
                  ? 'bg-[#ffd43b] text-black shadow-[2px_2px_0_#0c1d2d] -translate-y-0.5'
                  : 'bg-white text-black/80 hover:bg-[#e9f6ff] shadow-[1.5px_1.5px_0_#0c1d2d]'
              }
            `}
          >
            <Award className="w-3.5 h-3.5" />
            <span>EDIT PROFILE</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`
              px-3.5 py-2 rounded-xl border-2 border-[#0c1d2d] font-display font-black text-[11px] sm:text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5
              ${
                activeTab === 'settings'
                  ? 'bg-[#ffd43b] text-black shadow-[2px_2px_0_#0c1d2d] -translate-y-0.5'
                  : 'bg-white text-black/80 hover:bg-[#e9f6ff] shadow-[1.5px_1.5px_0_#0c1d2d]'
              }
            `}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>SETTINGS</span>
          </button>
        </div>

        {/* ================================================= */}
        {/* TAB 1: PROFILE OVERVIEW & PERFORMANCE             */}
        {/* ================================================= */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-5 items-start">
            {/* Primary Profile Identity Card */}
            <div className="bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] overflow-hidden self-start">
              <div className="bg-[#0c1d2d] text-white p-3.5 sm:p-4 border-b-2 border-[#0c1d2d] flex items-center justify-between">
                <span className="font-mono text-[10px] font-black tracking-widest text-[#38aef0] uppercase">
                  APTICKS ID: #{userId?.slice(0, 6).toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-[#32e875] text-[#0c1d2d] border border-[#0c1d2d] rounded-full px-2.5 py-0.5 font-display font-black text-[9px] uppercase shadow-[1px_1px_0_#0c1d2d]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0c1d2d] animate-pulse" />
                  ONLINE
                </span>
              </div>

              <div className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 sm:gap-4">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 bg-[#ffd43b] border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d] flex items-center justify-center font-display font-black text-2xl sm:text-3xl text-black overflow-hidden shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      firstLetter
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="inline-block bg-[#e9f6ff] text-[#0c1d2d] border border-[#0c1d2d] rounded-full px-2 py-0.2 text-[9px] font-mono font-black uppercase mb-1">
                      DIVISION 1
                    </div>
                    <h2 className="font-display font-black text-xl sm:text-2xl text-[#0c1d2d] uppercase tracking-tight truncate leading-none">
                      {effectiveDisplayName}
                    </h2>
                    <div className="font-mono text-xs sm:text-sm font-black text-[#2563eb] mt-1">
                      @{effectiveUsername}
                    </div>
                  </div>
                </div>

                {/* Bio / About */}
                <div className="mt-3.5 p-3 bg-[#faf9f6] border-[1.5px] border-[#0c1d2d]/20 rounded-xl">
                  <div className="font-mono text-[9px] font-black text-black/40 uppercase mb-0.5">
                    ABOUT / GOAL:
                  </div>
                  <p className="font-body font-semibold text-xs text-black/80 italic leading-relaxed">
                    {bio.trim()
                      ? `"${bio.trim()}"`
                      : '"Apticks competitor sharpening quantitative speed and logical reasoning daily."'}
                  </p>
                </div>

                {/* Core Statistics Deck */}
                <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-[#e9f6ff] border-[1.5px] border-[#0c1d2d]/20 rounded-xl">
                    <div className="font-display font-black text-base sm:text-lg text-[#071a2b]">
                      {questionStats?.solvedCount ?? 0}
                    </div>
                    <div className="font-mono text-[8px] sm:text-[9px] font-black uppercase text-black/50 mt-0.5">
                      SOLVED
                    </div>
                  </div>

                  <div className="p-2 bg-[#ffd43b] border-[1.5px] border-[#0c1d2d] rounded-xl shadow-[1.5px_1.5px_0_#0c1d2d]">
                    <div className="font-display font-black text-base sm:text-lg text-[#0c1d2d]">
                      {questionStats?.totalPoints ?? 0}
                    </div>
                    <div className="font-mono text-[8px] sm:text-[9px] font-black uppercase text-[#0c1d2d]/70 mt-0.5">
                      TOTAL XP
                    </div>
                  </div>

                  <div className="p-2 bg-[#32e875] border-[1.5px] border-[#0c1d2d] rounded-xl shadow-[1.5px_1.5px_0_#0c1d2d]">
                    <div className="font-display font-black text-base sm:text-lg text-[#0c1d2d]">
                      {questionStats?.accuracyRate ?? 0}%
                    </div>
                    <div className="font-mono text-[8px] sm:text-[9px] font-black uppercase text-[#0c1d2d]/70 mt-0.5">
                      ACCURACY
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-3.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('edit')}
                    className="flex-1 py-2 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border-[1.5px] border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#0c1d2d] cursor-pointer text-center transition-transform hover:-translate-y-0.5"
                  >
                    EDIT PROFILE →
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="py-2 px-3.5 bg-white hover:bg-[#f8fafc] text-[#0c1d2d] border-[1.5px] border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase shadow-[1.5px_1.5px_0_#0c1d2d] cursor-pointer text-center transition-transform hover:-translate-y-0.5"
                  >
                    SETTINGS
                  </button>
                </div>
              </div>
            </div>

            {/* Achievements & Performance Column */}
            <div className="space-y-5">
              {/* Badges Gallery Card */}
              <div className="bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] p-4 sm:p-5">
                <div className="flex items-center justify-between pb-2.5 border-b-[1.5px] border-[#0c1d2d]/15 mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#ffd43b]" />
                    <h3 className="font-display font-black text-sm uppercase text-[#0c1d2d]">
                      BADGES
                    </h3>
                  </div>
                  <span className="font-mono text-[10px] font-black text-black/50 uppercase">
                    4 / 12 UNLOCKED
                  </span>
                </div>

                {/* Compact 4-column equal-width badge gallery */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div
                    className="p-2.5 sm:p-3 bg-[#c084fc] border-[1.5px] border-[#0c1d2d] rounded-xl shadow-[1.5px_1.5px_0_#0c1d2d] flex flex-col items-center justify-center text-center gap-1.5 transition-transform hover:-translate-y-0.5 cursor-default"
                    title="Speed Demon: Solved problem < 30s"
                  >
                    <div className="w-7 h-7 rounded-lg bg-black/10 flex items-center justify-center">
                      <Trophy className="w-3.5 h-3.5 text-[#0c1d2d]" />
                    </div>
                    <span className="font-display font-black text-[10px] sm:text-[11px] leading-tight uppercase text-[#0c1d2d] truncate w-full">
                      SPEED DEMON
                    </span>
                  </div>

                  <div
                    className="p-2.5 sm:p-3 bg-[#ffd43b] border-[1.5px] border-[#0c1d2d] rounded-xl shadow-[1.5px_1.5px_0_#0c1d2d] flex flex-col items-center justify-center text-center gap-1.5 transition-transform hover:-translate-y-0.5 cursor-default"
                    title={
                      userStreak && userStreak.currentStreak > 0
                        ? `Streak Runner: Active ${userStreak.currentStreak}-Day streak`
                        : 'Streak Runner: Solve today to build streak'
                    }
                  >
                    <div className="w-7 h-7 rounded-lg bg-black/10 flex items-center justify-center">
                      <Flame
                        className={`w-3.5 h-3.5 text-[#0c1d2d] ${
                          userStreak?.isActiveToday ? 'animate-pulse' : ''
                        }`}
                      />
                    </div>
                    <span className="font-display font-black text-[10px] sm:text-[11px] leading-tight uppercase text-[#0c1d2d] truncate w-full">
                      STREAK RUNNER
                    </span>
                  </div>

                  <div
                    className="p-2.5 sm:p-3 bg-[#32e875] border-[1.5px] border-[#0c1d2d] rounded-xl shadow-[1.5px_1.5px_0_#0c1d2d] flex flex-col items-center justify-center text-center gap-1.5 transition-transform hover:-translate-y-0.5 cursor-default"
                    title="Accuracy Ace: > 80% accuracy score"
                  >
                    <div className="w-7 h-7 rounded-lg bg-black/10 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0c1d2d]" />
                    </div>
                    <span className="font-display font-black text-[10px] sm:text-[11px] leading-tight uppercase text-[#0c1d2d] truncate w-full">
                      ACCURACY ACE
                    </span>
                  </div>

                  <div
                    className="p-2.5 sm:p-3 bg-[#38aef0] border-[1.5px] border-[#0c1d2d] rounded-xl shadow-[1.5px_1.5px_0_#0c1d2d] flex flex-col items-center justify-center text-center gap-1.5 transition-transform hover:-translate-y-0.5 cursor-default"
                    title="Centurion: Earned 100+ XP in Season 1"
                  >
                    <div className="w-7 h-7 rounded-lg bg-black/10 flex items-center justify-center">
                      <Zap className="w-3.5 h-3.5 text-[#0c1d2d]" />
                    </div>
                    <span className="font-display font-black text-[10px] sm:text-[11px] leading-tight uppercase text-[#0c1d2d] truncate w-full">
                      CENTURION
                    </span>
                  </div>
                </div>
              </div>

              {/* Competitive Performance & Attempt History Deck */}
              <div className="bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] p-4 sm:p-5">
                <div className="flex items-center justify-between pb-2.5 border-b-[1.5px] border-[#0c1d2d]/15 mb-3.5">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#ffd43b]" />
                    <h3 className="font-display font-black text-sm uppercase text-[#0c1d2d]">
                      COMPETITIVE PERFORMANCE
                    </h3>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-black/50 uppercase">
                    XP BREAKDOWN & ATTEMPTS
                  </span>
                </div>

                {/* 7 Performance KPI Blocks */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6 text-center">
                  <div className="p-3 bg-[#e9f6ff] border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d]">
                    <div className="font-display font-black text-lg sm:text-xl text-black">
                      {questionStats?.totalAttempts ?? 0}
                    </div>
                    <div className="font-mono text-[9px] font-black uppercase text-black/70 mt-0.5">
                      ATTEMPTS
                    </div>
                  </div>

                  <div className="p-3 bg-[#d1fae5] border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d]">
                    <div className="font-display font-black text-lg sm:text-xl text-[#065f46]">
                      {questionStats?.correctAttempts ?? 0}
                    </div>
                    <div className="font-mono text-[9px] font-black uppercase text-[#065f46] mt-0.5">
                      CORRECT
                    </div>
                  </div>

                  <div className="p-3 bg-[#fee2e2] border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d]">
                    <div className="font-display font-black text-lg sm:text-xl text-[#991b1b]">
                      {questionStats?.incorrectAttempts ?? 0}
                    </div>
                    <div className="font-mono text-[9px] font-black uppercase text-[#991b1b] mt-0.5">
                      INCORRECT
                    </div>
                  </div>

                  <div className="p-3 bg-[#ffd43b] border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d]">
                    <div className="font-display font-black text-lg sm:text-xl text-black">
                      {questionStats?.accuracyRate ?? 0}%
                    </div>
                    <div className="font-mono text-[9px] font-black uppercase text-black/80 mt-0.5">
                      ACCURACY
                    </div>
                  </div>

                  <div className="p-3 bg-[#fefce8] border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d]">
                    <div className="font-display font-black text-base sm:text-lg text-[#854d0e]">
                      +{questionStats?.xpEarned ?? 0}
                    </div>
                    <div className="font-mono text-[9px] font-black uppercase text-[#854d0e] mt-0.5">
                      XP EARNED
                    </div>
                  </div>

                  <div className="p-3 bg-[#fff1f2] border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d]">
                    <div className="font-display font-black text-base sm:text-lg text-[#be123c]">
                      -{questionStats?.xpLost ?? 0}
                    </div>
                    <div className="font-mono text-[9px] font-black uppercase text-[#be123c] mt-0.5">
                      XP PENALTY
                    </div>
                  </div>

                  <div className="p-3 bg-black text-white border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d] col-span-2">
                    <div className="font-display font-black text-base sm:text-lg text-[#ffd43b]">
                      {questionStats?.netXp ?? 0} XP
                    </div>
                    <div className="font-mono text-[9px] font-black uppercase text-white/80 mt-0.5">
                      NET COMPETITIVE XP
                    </div>
                  </div>
                </div>

                {/* Recent Attempt History Feed */}
                <div>
                  <div className="flex items-center justify-between pb-2 border-b-2 border-[#0c1d2d] mb-3">
                    <div className="font-display font-black text-xs uppercase text-black">
                      RECENT ATTEMPT LOG
                    </div>
                    <div className="font-mono text-[10px] font-bold text-black/60">
                      {userAttempts.length} Records
                    </div>
                  </div>

                  {userAttempts.length === 0 ? (
                    <div className="p-4 bg-[#f8fafc] border-2 border-dashed border-[#0c1d2d]/30 rounded-xl text-center font-body text-xs font-semibold text-black/60">
                      No attempt history recorded yet. Solve problems in the Question Bank to build your competitive track record!
                    </div>
                  ) : (
                    <div
                      data-lenis-prevent
                      className="space-y-2 max-h-64 sm:max-h-72 question-list-scroll overflow-y-auto min-h-0 pr-1"
                    >
                      {userAttempts.map((att) => (
                        <div
                          key={att.id}
                          className="p-3 bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.2 bg-[#0c1d2d] text-white border border-[#0c1d2d] rounded text-[9px] font-mono font-black uppercase">
                                {att.questionId}
                              </span>
                              <span className="font-display font-black text-xs text-black truncate">
                                {att.questionTitle || `Attempt #${att.attemptNumber}`}
                              </span>
                            </div>
                            <div className="font-mono text-[10px] font-bold text-black/60 mt-0.5">
                              Option {att.selectedOption} • Attempt #{att.attemptNumber}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <span
                              className={`
                                inline-flex items-center px-2 py-0.5 border border-[#0c1d2d] rounded-lg font-mono font-black text-[10px] uppercase shadow-[1px_1px_0_#0c1d2d]
                                ${
                                  att.isCorrect
                                    ? 'bg-[#32e875] text-black'
                                    : 'bg-[#ff5b5b] text-white'
                                }
                              `}
                            >
                              {att.isCorrect ? `+${att.xpChange} XP` : `${att.xpChange} XP`}
                            </span>
                            <div className="font-mono text-[9px] text-black/50 mt-0.5">
                              {new Date(att.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* TAB 2: EDIT PROFILE FORM                          */}
        {/* ================================================= */}
        {activeTab === 'edit' && (
          <div className="max-w-2xl bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl sm:rounded-3xl shadow-[3px_3px_0_#0c1d2d] p-6 sm:p-8">
            <div className="border-b-2 border-[#0c1d2d] pb-4 mb-6">
              <div className="inline-block bg-[#38aef0] text-black border-2 border-[#0c1d2d] rounded-full px-3 py-0.5 text-[10px] font-mono font-black tracking-widest uppercase mb-2 shadow-[2px_2px_0_#0c1d2d]">
                CUSTOMIZE IDENTITY
              </div>
              <h2 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-black leading-none">
                EDIT PROFILE
              </h2>
              <p className="mt-1.5 text-xs font-body font-semibold text-black/70">
                Update your public handle, display name, avatar, and personal statement across Apticks.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 1. Avatar Uploader & Presets */}
              <div>
                <label className="block mb-2 text-xs font-display font-black tracking-wider text-black uppercase">
                  PROFILE AVATAR
                </label>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-16 h-16 bg-[#ffd43b] border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] flex items-center justify-center font-display font-black text-2xl text-black overflow-hidden shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      firstLetter
                    )}
                  </div>

                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarFileChange}
                      accept="image/png, image/jpeg, image/webp"
                      className="hidden"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="px-3.5 py-2 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-[#0c1d2d] rounded-lg font-display font-black text-xs uppercase shadow-[2px_2px_0_#0c1d2d] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingAvatar ? 'UPLOADING...' : 'UPLOAD PHOTO'}</span>
                      </button>

                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="px-3.5 py-2 bg-[#ff5b5b] text-white hover:bg-[#ef4444] border-2 border-[#0c1d2d] rounded-lg font-display font-black text-xs uppercase shadow-[2px_2px_0_#0c1d2d] cursor-pointer"
                        >
                          REMOVE
                        </button>
                      )}
                    </div>
                    <p className="font-mono text-[10px] text-black/60 font-semibold">
                      Square PNG, JPG, or WebP under 5MB.
                    </p>
                  </div>
                </div>

                {/* Avatar Presets */}
                <div className="mt-3 pt-3 border-t-2 border-[#0c1d2d]/10">
                  <span className="block font-mono text-[10px] font-black text-black/60 uppercase mb-2">
                    OR SELECT PRESET:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPresetAvatar(preset.url)}
                        className={`w-9 h-9 border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d] transition-transform hover:-translate-y-0.5 cursor-pointer ${
                          avatarUrl === preset.url ? 'ring-3 ring-black' : ''
                        }`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-full h-full rounded-xl" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Display Name */}
              <div>
                <label
                  htmlFor="displayName"
                  className="block mb-1 text-xs font-display font-black tracking-wider text-black uppercase"
                >
                  DISPLAY NAME
                </label>
                <div className="flex items-center bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] focus-within:shadow-[2px_2px_0_#38aef0] overflow-hidden">
                  <span className="px-3.5 py-3 border-r-2 border-[#0c1d2d] bg-[#f1f5f9] text-black flex items-center">
                    <User className="w-4 h-4 text-black" />
                  </span>
                  <input
                    id="displayName"
                    type="text"
                    placeholder="e.g. Alex Sharma"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    className="w-full py-3 px-3 outline-none font-display font-bold text-sm bg-transparent placeholder:text-black/35"
                  />
                </div>
              </div>

              {/* 3. Handle (14-day rule) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="username"
                    className="text-xs font-display font-black tracking-wider text-black uppercase"
                  >
                    USERNAME (HANDLE)
                  </label>

                  {usernameStatus && (
                    <span
                      className={`text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full border border-[#0c1d2d] ${
                        usernameStatus.isCurrent
                          ? 'bg-[#e9f6ff] text-[#071a2b]'
                          : usernameStatus.available
                          ? 'bg-[#d1fae5] text-[#065f46]'
                          : 'bg-[#fee2e2] text-[#991b1b]'
                      }`}
                    >
                      {checkingUsername
                        ? 'CHECKING...'
                        : usernameStatus.isCurrent
                        ? '[CURRENT]'
                        : usernameStatus.available
                        ? '[✓] AVAILABLE'
                        : '[✕] TAKEN'}
                    </span>
                  )}
                </div>

                {!cooldown.canChange && (
                  <div className="mb-2 p-3 bg-[#fffde7] border-2 border-[#0c1d2d] rounded-xl text-xs font-body font-bold text-[#926002] flex items-start gap-2">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5 text-black" />
                    <div>
                      <strong>Handle locked:</strong> Usernames can only be changed once every 14 days. Available in{' '}
                      <strong>{cooldown.daysLeft} day(s)</strong> on{' '}
                      <strong>{cooldown.formattedNextChangeDate}</strong>.
                    </div>
                  </div>
                )}

                <div className="flex items-center bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] focus-within:shadow-[2px_2px_0_#38aef0] overflow-hidden">
                  <span className="px-3.5 py-3 border-r-2 border-[#0c1d2d] bg-[#f1f5f9] text-black font-display font-black text-sm">
                    @
                  </span>
                  <input
                    id="username"
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    disabled={!cooldown.canChange}
                    placeholder="your_handle"
                    maxLength={20}
                    className="w-full py-3 px-3 outline-none font-display font-bold text-sm bg-transparent placeholder:text-black/35 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 4. Bio */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="bio"
                    className="text-xs font-display font-black tracking-wider text-black uppercase"
                  >
                    BIO / STATEMENT
                  </label>
                  <span className="font-mono text-[10px] font-bold text-black/60">
                    {bio.length} / 160
                  </span>
                </div>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your target exams, college, or aptitude goals..."
                  maxLength={160}
                  rows={3}
                  className="w-full p-3 bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] outline-none font-body font-semibold text-sm placeholder:text-black/35 focus:shadow-[2px_2px_0_#38aef0]"
                />
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={
                  saving ||
                  (normalizeUsername(usernameInput) !==
                    normalizeUsername(originalProfile?.username || '') &&
                    (!usernameStatus?.available || !cooldown.canChange))
                }
                className="w-full py-3.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3.5px_3.5px_0_#000000] font-display font-black text-sm tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>{saving ? 'SAVING CHANGES...' : 'SAVE PROFILE CHANGES'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ================================================= */}
        {/* TAB 3: SETTINGS & ACCOUNT SECURITY                */}
        {/* ================================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-6">
            {/* 1. Account / Recovery Email */}
            <section className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl sm:rounded-3xl shadow-[3px_3px_0_#0c1d2d] p-6 sm:p-8">
              <div className="border-b-2 border-[#0c1d2d] pb-3 mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-5 h-5 text-black" />
                  <h3 className="font-display font-black text-xl uppercase text-black">
                    ACCOUNT EMAIL
                  </h3>
                </div>
                {isEmailVerified ? (
                  <span className="bg-[#32e875] border-2 border-[#0c1d2d] rounded-full px-3 py-0.5 font-mono text-[10px] font-black uppercase shadow-[1.5px_1.5px_0_#0c1d2d]">
                    VERIFIED
                  </span>
                ) : (
                  <span className="bg-[#ffd43b] border-2 border-[#0c1d2d] rounded-full px-3 py-0.5 font-mono text-[10px] font-black uppercase shadow-[1.5px_1.5px_0_#0c1d2d]">
                    UNLINKED
                  </span>
                )}
              </div>

              <div className="p-4 bg-[#f8fafc] border-2 border-[#0c1d2d] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <div className="font-display font-black text-xs uppercase text-black mb-0.5">
                    RECOVERY & NOTIFICATION EMAIL
                  </div>
                  <div className="font-body font-bold text-sm text-black/80 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-black" />
                    <span>{isEmailVerified ? userEmail : 'No verified email linked yet'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEmailModalOpen(true)
                    setEmailInput('')
                    setOtpStep(false)
                    setOtpCode('')
                    setEmailModalError(null)
                    setEmailModalSuccess(null)
                  }}
                  className="px-4 py-2 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-[#0c1d2d] rounded-lg font-display font-black text-xs uppercase shadow-[2px_2px_0_#0c1d2d] cursor-pointer"
                >
                  {isEmailVerified ? 'CHANGE EMAIL' : '+ LINK EMAIL'}
                </button>
              </div>

              <p className="text-xs font-body font-semibold text-black/70">
                A verified email enables password recovery and official contest notifications.
              </p>
            </section>

            {/* 2. Security & Password */}
            <section className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl sm:rounded-3xl shadow-[3px_3px_0_#0c1d2d] p-6 sm:p-8">
              <div className="border-b-2 border-[#0c1d2d] pb-3 mb-5 flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-black" />
                <h3 className="font-display font-black text-xl uppercase text-black">
                  SECURITY CREDENTIALS
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#f8fafc] border-2 border-[#0c1d2d] rounded-xl">
                <div>
                  <div className="font-display font-black text-xs uppercase text-black">
                    ACCOUNT PASSWORD
                  </div>
                  <div className="text-xs font-semibold text-black/70 mt-0.5">
                    Keep your account secure with regular updates.
                  </div>
                </div>

                <Link
                  to="/update-password"
                  className="inline-flex items-center gap-2 text-xs font-display font-black text-black hover:text-[#2563eb] border-2 border-[#0c1d2d] rounded-lg bg-white px-4 py-2 shadow-[2px_2px_0_#0c1d2d] uppercase tracking-wider transition-transform hover:-translate-x-0.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>CHANGE PASSWORD →</span>
                </Link>
              </div>
            </section>

            {/* 3. Preferences */}
            <section className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl sm:rounded-3xl shadow-[3px_3px_0_#0c1d2d] p-6 sm:p-8">
              <div className="border-b-2 border-[#0c1d2d] pb-3 mb-5 flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-black" />
                <h3 className="font-display font-black text-xl uppercase text-black">
                  ARENA PREFERENCES
                </h3>
              </div>

              <div className="p-4 bg-[#f8fafc] border-2 border-[#0c1d2d] rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-display font-black text-xs uppercase text-black">
                    REDUCED MOTION COMPLIANCE
                  </div>
                  <div className="text-xs font-semibold text-black/70 mt-0.5">
                    Automatically adapts to system prefers-reduced-motion settings.
                  </div>
                </div>
                <span className="bg-[#32e875] border-2 border-[#0c1d2d] rounded-full px-2.5 py-0.5 font-mono text-[10px] font-black uppercase">
                  AUTO ENABLED
                </span>
              </div>
            </section>

            {/* 4. Session & Destructive Logout */}
            <section className="bg-[#fee2e2] border-2 sm:border-2 border-[#0c1d2d] rounded-xl sm:rounded-3xl shadow-[3px_3px_0_#0c1d2d] p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-display font-black text-lg uppercase text-[#991b1b]">
                    LOG OUT OF ARENA SESSION
                  </div>
                  <div className="text-xs font-semibold text-black/75 mt-0.5">
                    End your current session on this browser device.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="px-5 py-2.5 bg-[#ff5b5b] hover:bg-[#ef4444] text-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] font-display font-black text-xs uppercase tracking-wider transition-all hover:-translate-x-0.5 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{loggingOut ? 'LOGGING OUT...' : 'LOG OUT NOW'}</span>
                </button>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* ================================================= */}
      {/* IN-APP OTP EMAIL LINKING MODAL                     */}
      {/* ================================================= */}
      {emailModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setEmailModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl sm:rounded-3xl shadow-[8px_8px_0_#ffd43b] p-6 sm:p-8 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#0c1d2d] mb-5">
              <div className="font-display font-black text-lg uppercase text-black">
                {otpStep ? 'VERIFY EMAIL CODE' : 'LINK RECOVERY EMAIL'}
              </div>
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="w-7 h-7 border-2 border-[#0c1d2d] rounded-lg bg-[#ff5b5b] text-white flex items-center justify-center font-black cursor-pointer hover:bg-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailModalError && (
              <div className="mb-4 p-3 bg-[#fee2e2] border-2 border-[#0c1d2d] rounded-xl text-[#991b1b] font-display font-black text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{emailModalError}</span>
              </div>
            )}

            {emailModalSuccess && (
              <div className="mb-4 p-3 bg-[#d1fae5] border-2 border-[#0c1d2d] rounded-xl text-[#065f46] font-display font-black text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{emailModalSuccess}</span>
              </div>
            )}

            {!otpStep ? (
              <form onSubmit={handleInitiateEmailLink} className="space-y-4">
                <p className="text-xs font-body font-semibold text-black/80">
                  Enter your real email address. We will send a 6-digit OTP code to verify ownership.
                </p>

                <div>
                  <label
                    htmlFor="modal-email-input"
                    className="block mb-1 text-xs font-display font-black tracking-wider text-black uppercase"
                  >
                    REAL EMAIL / GMAIL
                  </label>
                  <div className="flex items-center bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d] overflow-hidden">
                    <span className="px-3.5 py-3 border-r-2 border-[#0c1d2d] bg-[#f1f5f9] text-black flex items-center">
                      <Mail className="w-4 h-4 text-black" />
                    </span>
                    <input
                      id="modal-email-input"
                      type="email"
                      placeholder="yourname@gmail.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                      autoFocus
                      className="w-full py-2.5 px-3 outline-none font-display font-bold text-sm bg-transparent placeholder:text-black/35"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={emailLoading}
                  className="w-full py-3.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] font-display font-black text-xs sm:text-sm tracking-wider uppercase transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  <span>{emailLoading ? 'SENDING CODE...' : 'SEND VERIFICATION CODE'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-xs font-body font-semibold text-black/80">
                  Enter the 6-digit verification code sent to <strong>{emailInput}</strong>.
                </p>

                <div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    className="w-full py-3 px-4 text-center font-mono font-black text-2xl tracking-[0.4em] bg-[#f8fafc] border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] outline-none focus:shadow-[2px_2px_0_#38aef0]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={emailLoading || otpCode.length < 6}
                  className="w-full py-3.5 bg-[#32e875] hover:bg-[#22c55e] border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] font-display font-black text-xs sm:text-sm tracking-wider uppercase transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  <span>{emailLoading ? 'VERIFYING...' : 'VERIFY & LINK EMAIL'}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-between pt-2 border-t-2 border-[#0c1d2d]/10">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={emailLoading}
                    className="text-xs font-display font-bold text-black/70 hover:text-black underline cursor-pointer flex items-center gap-1"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Resend Code</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep(false)
                      setOtpCode('')
                      setEmailModalError(null)
                      setEmailModalSuccess(null)
                    }}
                    className="text-xs font-display font-bold text-black/70 hover:text-black underline cursor-pointer"
                  >
                    Use Different Email
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}
