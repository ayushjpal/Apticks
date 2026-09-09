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
  Target,
  Calendar,
  Star,
  Crown,
  Crosshair,
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
import { LeaderboardService } from '../../services/leaderboardService'
import { GamificationService } from '../../services/gamificationService'
import { calculateLevelProgress, type LevelProgress } from '../../utils/levelEngine'
import type { QuestionBankStats, UserQuestionAttempt, UserStreak } from '../../types/questions'
import type { BadgeWithProgress, BadgeTier } from '../../types/gamification'
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

// Helper for badge category / criteria icons
const renderBadgeIcon = (iconName: string, className?: string) => {
  switch (iconName?.toLowerCase()) {
    case 'target':
      return <Target className={className} />
    case 'zap':
      return <Zap className={className} />
    case 'award':
      return <Award className={className} />
    case 'trophy':
      return <Trophy className={className} />
    case 'flame':
      return <Flame className={className} />
    case 'calendar':
      return <Calendar className={className} />
    case 'star':
      return <Star className={className} />
    case 'sparkles':
      return <Sparkles className={className} />
    case 'crown':
      return <Crown className={className} />
    case 'check-circle':
      return <CheckCircle2 className={className} />
    case 'crosshair':
      return <Crosshair className={className} />
    case 'shield':
      return <Shield className={className} />
    default:
      return <Award className={className} />
  }
}

// Helper for tier color themes
const getTierStyle = (tier: BadgeTier, isUnlocked: boolean) => {
  if (!isUnlocked) {
    return {
      card: 'bg-slate-50/50 border-slate-200/70 opacity-80 hover:opacity-100 transition-opacity',
      pill: 'bg-slate-100 text-slate-500 border-slate-200',
      iconBox: 'bg-slate-100 border-slate-200 text-slate-400',
    }
  }

  switch (tier) {
    case 'bronze':
      return {
        card: 'bg-gradient-to-br from-amber-50/40 to-orange-50/20 border-amber-200/80 shadow-xs hover:border-amber-300 transition-colors',
        pill: 'bg-amber-100/80 text-amber-900 border-amber-300/80',
        iconBox: 'bg-amber-100 border-amber-200 text-amber-800',
      }
    case 'silver':
      return {
        card: 'bg-gradient-to-br from-slate-50 to-gray-50/60 border-slate-300/80 shadow-xs hover:border-slate-400 transition-colors',
        pill: 'bg-slate-100 text-slate-800 border-slate-300',
        iconBox: 'bg-slate-100 border-slate-300 text-slate-700',
      }
    case 'gold':
      return {
        card: 'bg-gradient-to-br from-yellow-50/50 to-amber-50/30 border-amber-300/90 shadow-xs hover:border-amber-400 transition-colors',
        pill: 'bg-amber-100 text-amber-950 border-amber-400',
        iconBox: 'bg-yellow-100 border-yellow-300 text-yellow-800',
      }
    case 'platinum':
      return {
        card: 'bg-gradient-to-br from-purple-50/50 to-indigo-50/30 border-purple-300/90 shadow-xs hover:border-purple-400 transition-colors',
        pill: 'bg-purple-100 text-purple-950 border-purple-300',
        iconBox: 'bg-purple-100 border-purple-300 text-purple-800',
      }
    default:
      return {
        card: 'bg-slate-50 border-slate-200 shadow-xs',
        pill: 'bg-slate-100 text-slate-700 border-slate-200',
        iconBox: 'bg-slate-100 border-slate-200 text-slate-600',
      }
  }
}

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
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null)
  const [badges, setBadges] = useState<BadgeWithProgress[]>([])
  const [unlockedBadgeCount, setUnlockedBadgeCount] = useState<number>(0)
  const [totalBadgeCount, setTotalBadgeCount] = useState<number>(0)
  const [badgesLoading, setBadgesLoading] = useState<boolean>(true)
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all')

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
          const [
            { questions, progressMap, challengeBonusXp, contestXp },
            attempts,
            streak,
            rankRes,
          ] = await Promise.all([
            QuestionService.getQuestionsWithProgress(user.id),
            QuestionService.getUserAttempts(user.id, 20),
            StreakService.getUserStreak(user.id),
            LeaderboardService.getUserGlobalRank(user.id),
          ])
          const stats = QuestionService.calculateStats(
            questions,
            progressMap,
            attempts,
            challengeBonusXp,
            contestXp,
            rankRes.found ? rankRes.totalXp : undefined
          )
          if (isMounted) {
            setQuestionStats(stats)
            setUserAttempts(attempts)
            setUserStreak(streak)
            if (rankRes.found && rankRes.levelProgress) {
              setLevelProgress(rankRes.levelProgress)
            } else {
              setLevelProgress(calculateLevelProgress(stats.totalPoints))
            }
          }
        } catch (qErr) {
          console.warn('Could not load profile question stats/streak:', qErr)
        }

        // Authoritative badges & trigger non-blocking session evaluation
        try {
          GamificationService.evaluateUserBadges().catch(() => null)
          const badgeRes = await GamificationService.getUserBadges(user.id)
          if (isMounted) {
            setBadges(badgeRes.badges)
            setUnlockedBadgeCount(badgeRes.unlockedCount)
            setTotalBadgeCount(badgeRes.totalCount)
          }
        } catch (bErr) {
          console.warn('Could not load user badges:', bErr)
        } finally {
          if (isMounted) {
            setBadgesLoading(false)
          }
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
        <div className="text-center font-display">
          <div className="w-10 h-10 border-2 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold tracking-wide text-white/70">Loading profile...</p>
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
    <AppLayout maxWidth="narrow">
      <div className="space-y-5 animate-entry">
        {/* Success Alert */}
        {saveSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Profile changes saved successfully</span>
            </div>
            <button
              onClick={() => setSaveSuccess(false)}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs font-medium text-rose-700 hover:text-rose-900 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ================================================= */}
        {/* TOP TABBED NAVIGATION CONTROLS                    */}
        {/* ================================================= */}
        <div className="flex items-center gap-2 border-b border-[#0c1d2d]/10 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`
              px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer
              ${
                activeTab === 'overview'
                  ? 'bg-[#0c1d2d] text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }
            `}
          >
            <User className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`
              px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer
              ${
                activeTab === 'edit'
                  ? 'bg-[#0c1d2d] text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }
            `}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`
              px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer
              ${
                activeTab === 'settings'
                  ? 'bg-[#0c1d2d] text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }
            `}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>

        {/* ================================================= */}
        {/* TAB 1: PROFILE OVERVIEW & PERFORMANCE             */}
        {/* ================================================= */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-5 items-start">
            {/* ================================================= */}
            {/* LEFT COLUMN: Profile Identity + Earned Badges     */}
            {/* ================================================= */}
            <div className="space-y-5">
              {/* 1. Primary Profile Identity Card */}
              <div className="bg-white border border-[#0c1d2d]/12 rounded-2xl shadow-xs overflow-hidden">
                <div className="bg-[#0c1d2d] text-white px-4 py-3 border-b border-[#0c1d2d]/10 flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold tracking-wider text-[#38aef0]">
                    APTICKS ID: #{userId?.slice(0, 6).toUpperCase()}
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-2.5 py-0.5 text-[10px] font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 sm:w-18 sm:h-18 bg-[#ffd43b] border border-[#0c1d2d]/15 rounded-2xl shadow-xs flex items-center justify-center font-display font-black text-2xl sm:text-3xl text-[#0c1d2d] overflow-hidden shrink-0">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        firstLetter
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <div className="inline-block bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold">
                          Division 1
                        </div>
                        {userStreak && userStreak.currentStreak > 0 && (
                          <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold">
                            <Flame className="w-3 h-3 text-amber-600" />
                            <span>{userStreak.currentStreak}d Streak</span>
                          </div>
                        )}
                      </div>
                      <h2 className="font-display font-bold text-xl sm:text-2xl text-[#0c1d2d] tracking-tight truncate leading-tight">
                        {effectiveDisplayName}
                      </h2>
                      <div className="font-mono text-xs sm:text-sm font-medium text-[#2563eb] mt-0.5 truncate">
                        @{effectiveUsername}
                      </div>
                    </div>
                  </div>

                  {/* Bio / About */}
                  <div className="mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <div className="font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      About / Goal
                    </div>
                    <p className="font-body text-xs text-slate-700 italic leading-relaxed">
                      {bio.trim()
                        ? `"${bio.trim()}"`
                        : '"Apticks competitor sharpening quantitative speed and logical reasoning daily."'}
                    </p>
                  </div>

                  {/* Core Statistics Deck */}
                  <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                      <div className="font-display font-bold text-lg sm:text-xl text-[#0c1d2d]">
                        {questionStats?.solvedCount ?? 0}
                      </div>
                      <div className="font-mono text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                        Solved
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl">
                      <div className="font-display font-bold text-lg sm:text-xl text-[#0c1d2d]">
                        {questionStats?.totalPoints ?? 0}
                      </div>
                      <div className="font-mono text-[10px] font-semibold text-amber-800 uppercase tracking-wider mt-0.5">
                        Total XP
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
                      <div className="font-display font-bold text-lg sm:text-xl text-[#0c1d2d]">
                        {questionStats?.accuracyRate ?? 0}%
                      </div>
                      <div className="font-mono text-[10px] font-semibold text-emerald-800 uppercase tracking-wider mt-0.5">
                        Accuracy
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('edit')}
                      className="flex-1 py-2 px-3 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border border-[#0c1d2d]/20 rounded-xl font-display font-bold text-xs shadow-xs cursor-pointer text-center transition-colors"
                    >
                      Edit Profile →
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="py-2 px-4 bg-white hover:bg-slate-50 text-[#0c1d2d] border border-slate-200 rounded-xl font-display font-bold text-xs shadow-xs cursor-pointer text-center transition-colors"
                    >
                      Settings
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Level Progression Card */}
              <div className="bg-white border border-[#0c1d2d]/12 rounded-2xl shadow-xs p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#0c1d2d]" />
                    <h3 className="font-display font-bold text-sm text-[#0c1d2d]">
                      Level & Progression
                    </h3>
                  </div>
                  <span className="bg-[#0c1d2d] text-[#ffd43b] px-2 py-0.5 rounded text-[10px] font-display font-black tracking-wider uppercase">
                    LVL {levelProgress?.level ?? 1}
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Tier & XP Summary */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">
                        Rank Tier
                      </div>
                      <div className="font-display font-black text-base text-[#0c1d2d]">
                        {levelProgress?.title ?? 'Novice'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-wider">
                        Authoritative XP
                      </div>
                      <div className="font-display font-black text-base text-[#0c1d2d]">
                        {levelProgress?.totalXp ?? questionStats?.totalPoints ?? 0} XP
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-600 mb-1.5">
                      <span>
                        {levelProgress?.xpInLevel ?? 0} / {(levelProgress?.nextLevelXp ?? 100) - (levelProgress?.currentLevelXp ?? 0)} XP in Level
                      </span>
                      <span className="font-semibold text-[#0c1d2d]">
                        {levelProgress?.progressPercentage ?? 0}%
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 border border-[#0c1d2d]/10 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-[#ffd43b] rounded-full transition-all duration-300"
                        style={{ width: `${levelProgress?.progressPercentage ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* XP Needed */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">To Next Level:</span>
                    <span className="font-mono font-bold text-[#0c1d2d]">
                      {levelProgress?.xpRequired ?? 0} XP needed for Level {(levelProgress?.level ?? 1) + 1}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Badges Gallery Card */}
              <div className="bg-white border border-[#0c1d2d]/12 rounded-2xl shadow-xs p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h3 className="font-display font-bold text-sm text-[#0c1d2d]">
                      Earned Badges
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/60">
                    {unlockedBadgeCount} / {totalBadgeCount} unlocked
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 mb-4">
                  <button
                    type="button"
                    onClick={() => setBadgeFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-bold transition-all cursor-pointer ${
                      badgeFilter === 'all'
                        ? 'bg-[#0c1d2d] text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                    }`}
                  >
                    All ({totalBadgeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBadgeFilter('unlocked')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-bold transition-all cursor-pointer ${
                      badgeFilter === 'unlocked'
                        ? 'bg-[#0c1d2d] text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                    }`}
                  >
                    Unlocked ({unlockedBadgeCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBadgeFilter('locked')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-bold transition-all cursor-pointer ${
                      badgeFilter === 'locked'
                        ? 'bg-[#0c1d2d] text-white shadow-xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                    }`}
                  >
                    In Progress ({Math.max(0, totalBadgeCount - unlockedBadgeCount)})
                  </button>
                </div>

                {/* Badges Gallery */}
                {badgesLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl animate-pulse flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="w-8 h-8 rounded-lg bg-slate-200" />
                          <div className="w-12 h-3.5 bg-slate-200 rounded" />
                        </div>
                        <div className="w-20 h-3 bg-slate-200 rounded" />
                        <div className="w-full h-2 bg-slate-200 rounded" />
                      </div>
                    ))}
                  </div>
                ) : badges.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-500 font-medium">
                      No achievements catalog loaded.
                    </p>
                  </div>
                ) : badges.filter((b) => {
                    if (badgeFilter === 'unlocked') return b.isUnlocked
                    if (badgeFilter === 'locked') return !b.isUnlocked
                    return true
                  }).length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-500 font-medium">
                      {badgeFilter === 'unlocked'
                        ? 'No unlocked badges yet. Solve problems and build streaks to earn your first badge!'
                        : 'All badges are already unlocked! Amazing achievement!'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[620px] overflow-y-auto pr-1">
                    {badges
                      .filter((b) => {
                        if (badgeFilter === 'unlocked') return b.isUnlocked
                        if (badgeFilter === 'locked') return !b.isUnlocked
                        return true
                      })
                      .map((badge) => {
                        const style = getTierStyle(badge.tier, badge.isUnlocked)
                        return (
                          <div
                            key={badge.id}
                            className={`p-3 border rounded-xl flex flex-col justify-between transition-all ${style.card}`}
                            title={`${badge.title}: ${badge.description}`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div
                                  className={`w-8 h-8 rounded-lg border flex items-center justify-center ${style.iconBox}`}
                                >
                                  {renderBadgeIcon(badge.icon, 'w-4 h-4')}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${style.pill}`}
                                  >
                                    {badge.tier}
                                  </span>
                                  {badge.isUnlocked ? (
                                    <span title="Unlocked">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    </span>
                                  ) : (
                                    <span title="Locked">
                                      <Lock className="w-3 h-3 text-slate-400" />
                                    </span>
                                  )}
                                </div>
                              </div>

                              <h4 className="font-display font-bold text-xs text-[#0c1d2d] leading-tight">
                                {badge.title}
                              </h4>
                              <p className="text-[11px] text-slate-500 leading-snug line-clamp-2 mt-0.5">
                                {badge.description}
                              </p>
                            </div>

                            {/* Footer: Date or Progress Bar */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100/80">
                              {badge.isUnlocked ? (
                                <div className="flex items-center justify-between text-[10px] font-mono text-emerald-700">
                                  <span className="font-semibold flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-500" /> Unlocked
                                  </span>
                                  <span className="text-slate-500">
                                    {badge.unlockedAt
                                      ? new Date(badge.unlockedAt).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                        })
                                      : 'Achieved'}
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-slate-400 rounded-full transition-all duration-300"
                                      style={{ width: `${badge.progressPercentage}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1">
                                    <span>
                                      {badge.currentProgress} / {badge.criteriaThreshold}
                                    </span>
                                    <span className="font-semibold text-slate-600">
                                      {badge.progressPercentage}%
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* ================================================= */}
            {/* RIGHT COLUMN: Performance + Recent Attempts       */}
            {/* ================================================= */}
            <div className="space-y-5">
              {/* 3. Competitive Performance Deck */}
              <div className="bg-white border border-[#0c1d2d]/12 rounded-2xl shadow-xs p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <h3 className="font-display font-bold text-sm text-[#0c1d2d]">
                      Competitive Performance
                    </h3>
                  </div>
                  <span className="font-mono text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    XP Breakdown & Attempts
                  </span>
                </div>

                {/* 7 Performance KPI Blocks */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <div className="font-display font-bold text-lg sm:text-xl text-[#0c1d2d]">
                      {questionStats?.totalAttempts ?? 0}
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                      Attempts
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/60 border border-emerald-200/70 rounded-xl">
                    <div className="font-display font-bold text-lg sm:text-xl text-emerald-800">
                      {questionStats?.correctAttempts ?? 0}
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mt-0.5">
                      Correct
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/60 border border-rose-200/70 rounded-xl">
                    <div className="font-display font-bold text-lg sm:text-xl text-rose-800">
                      {questionStats?.incorrectAttempts ?? 0}
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-rose-700 uppercase tracking-wider mt-0.5">
                      Incorrect
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl">
                    <div className="font-display font-bold text-lg sm:text-xl text-amber-900">
                      {questionStats?.accuracyRate ?? 0}%
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-amber-800 uppercase tracking-wider mt-0.5">
                      Accuracy
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50/40 border border-emerald-100 rounded-xl">
                    <div className="font-display font-bold text-base sm:text-lg text-emerald-700">
                      +{questionStats?.xpEarned ?? 0}
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">
                      XP Earned
                    </div>
                  </div>

                  <div className="p-3 bg-rose-50/40 border border-rose-100 rounded-xl">
                    <div className="font-display font-bold text-base sm:text-lg text-rose-700">
                      -{questionStats?.xpLost ?? 0}
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-rose-600 uppercase tracking-wider mt-0.5">
                      XP Penalty
                    </div>
                  </div>

                  <div className="p-3 bg-[#0c1d2d] text-white border border-[#0c1d2d] rounded-xl col-span-2 flex items-center justify-between px-4">
                    <div>
                      <div className="font-mono text-[10px] font-medium text-white/60 uppercase tracking-wider">
                        Net Arena XP
                      </div>
                      <div className="font-display font-bold text-lg sm:text-xl text-[#ffd43b]">
                        {questionStats?.netXp ?? 0} XP
                      </div>
                    </div>
                    <Zap className="w-5 h-5 text-[#ffd43b]/60" />
                  </div>
                </div>
              </div>

              {/* 4. Recent Attempt History Deck */}
              <div className="bg-white border border-[#0c1d2d]/12 rounded-2xl shadow-xs p-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <h3 className="font-display font-bold text-sm text-[#0c1d2d]">
                      Recent Attempt Log
                    </h3>
                  </div>
                  <span className="font-mono text-[11px] font-medium text-slate-500">
                    {userAttempts.length} Records
                  </span>
                </div>

                {userAttempts.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center font-body text-xs font-medium text-slate-500">
                    No attempt history recorded yet. Solve problems in the Question Bank to build your competitive track record!
                  </div>
                ) : (
                  <div
                    data-lenis-prevent
                    className="space-y-2 max-h-72 question-list-scroll overflow-y-auto min-h-0 pr-1"
                  >
                    {userAttempts.map((att) => (
                      <div
                        key={att.id}
                        className="p-3 bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/70 rounded-xl flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-[#0c1d2d] text-white rounded text-[9px] font-mono font-bold uppercase">
                              {att.questionId}
                            </span>
                            <span className="font-display font-bold text-xs text-[#0c1d2d] truncate">
                              {att.questionTitle || `Attempt #${att.attemptNumber}`}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                            Option {att.selectedOption} • Attempt #{att.attemptNumber}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span
                            className={`
                              inline-flex items-center px-2 py-0.5 border rounded-md font-mono font-bold text-[10px]
                              ${
                                att.isCorrect
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }
                            `}
                          >
                            {att.isCorrect ? `+${att.xpChange} XP` : `${att.xpChange} XP`}
                          </span>
                          <div className="font-mono text-[9px] text-slate-400 mt-0.5">
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
        )}

        {/* ================================================= */}
        {/* TAB 2: EDIT PROFILE FORM                          */}
        {/* ================================================= */}
        {activeTab === 'edit' && (
          <div className="max-w-2xl bg-white border border-[#0c1d2d]/12 rounded-2xl shadow-xs p-6 sm:p-8">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <div className="inline-block bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold tracking-wider uppercase mb-2">
                Customize Identity
              </div>
              <h2 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-[#0c1d2d] leading-tight">
                Edit Profile
              </h2>
              <p className="mt-1 text-xs font-body text-slate-500">
                Update your public handle, display name, avatar, and personal statement across Apticks.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 1. Avatar Uploader & Presets */}
              <div>
                <label className="block mb-2 text-xs font-display font-bold text-slate-700 uppercase tracking-wider">
                  Profile Avatar
                </label>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-16 h-16 bg-[#ffd43b] border border-[#0c1d2d]/15 rounded-2xl shadow-xs flex items-center justify-center font-display font-bold text-2xl text-[#0c1d2d] overflow-hidden shrink-0">
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
                        className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg font-display font-bold text-xs text-slate-700 shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
                      </button>

                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg font-display font-bold text-xs cursor-pointer transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="font-mono text-[10px] text-slate-400">
                      Square PNG, JPG, or WebP under 5MB.
                    </p>
                  </div>
                </div>

                {/* Avatar Presets */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="block font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Or select preset:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPresetAvatar(preset.url)}
                        className={`w-9 h-9 border rounded-xl shadow-xs transition-all cursor-pointer overflow-hidden ${
                          avatarUrl === preset.url
                            ? 'border-[#0c1d2d] ring-2 ring-[#0c1d2d]/30'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <img src={preset.url} alt={preset.label} className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Display Name */}
              <div>
                <label
                  htmlFor="displayName"
                  className="block mb-1.5 text-xs font-display font-bold tracking-wider text-slate-700 uppercase"
                >
                  Display Name
                </label>
                <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden">
                  <span className="px-3.5 py-2.5 border-r border-slate-100 bg-slate-50 text-slate-500 flex items-center">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="displayName"
                    type="text"
                    placeholder="e.g. Alex Sharma"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    className="w-full py-2.5 px-3 outline-none font-display font-semibold text-sm bg-transparent placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* 3. Handle (14-day rule) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="username"
                    className="text-xs font-display font-bold tracking-wider text-slate-700 uppercase"
                  >
                    Username (Handle)
                  </label>

                  {usernameStatus && (
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        usernameStatus.isCurrent
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : usernameStatus.available
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {checkingUsername
                        ? 'Checking...'
                        : usernameStatus.isCurrent
                        ? 'Current'
                        : usernameStatus.available
                        ? 'Available'
                        : 'Taken'}
                    </span>
                  )}
                </div>

                {!cooldown.canChange && (
                  <div className="mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-body text-amber-900 flex items-start gap-2">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                    <div>
                      <strong>Handle locked:</strong> Usernames can only be changed once every 14 days. Available in{' '}
                      <strong>{cooldown.daysLeft} day(s)</strong> on{' '}
                      <strong>{cooldown.formattedNextChangeDate}</strong>.
                    </div>
                  </div>
                )}

                <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden">
                  <span className="px-3.5 py-2.5 border-r border-slate-100 bg-slate-50 text-slate-500 font-display font-bold text-sm">
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
                    className="w-full py-2.5 px-3 outline-none font-display font-semibold text-sm bg-transparent placeholder:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 4. Bio */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="bio"
                    className="text-xs font-display font-bold tracking-wider text-slate-700 uppercase"
                  >
                    Bio / Statement
                  </label>
                  <span className="font-mono text-[10px] text-slate-400">
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
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl shadow-xs outline-none font-body text-sm placeholder:text-slate-400 focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d]"
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
                className="w-full py-3 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border border-[#0c1d2d]/20 rounded-xl shadow-xs font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>{saving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ================================================= */}
        {/* TAB 3: SETTINGS & ACCOUNT SECURITY                */}
        {/* ================================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-5">
            {/* 1. Account / Recovery Email */}
            <section className="bg-white border border-[#0c1d2d]/12 rounded-2xl shadow-xs p-6 sm:p-7">
              <div className="border-b border-slate-100 pb-3 mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-5 h-5 text-slate-700" />
                  <h3 className="font-display font-bold text-lg text-[#0c1d2d]">
                    Account Email
                  </h3>
                </div>
                {isEmailVerified ? (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                    Verified
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                    Unlinked
                  </span>
                )}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <div className="font-display font-bold text-xs uppercase text-slate-700 mb-0.5">
                    Recovery & Notification Email
                  </div>
                  <div className="font-body font-medium text-sm text-slate-800 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-slate-500" />
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
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg font-display font-bold text-xs text-[#0c1d2d] shadow-xs cursor-pointer transition-colors"
                >
                  {isEmailVerified ? 'Change Email' : '+ Link Email'}
                </button>
              </div>

              <p className="text-xs font-body text-slate-500">
                A verified email enables password recovery and official contest notifications.
              </p>
            </section>

            {/* 2. Security & Password */}
            <section className="bg-white border border-[#0c1d2d]/12 rounded-2xl shadow-xs p-6 sm:p-7">
              <div className="border-b border-slate-100 pb-3 mb-5 flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-slate-700" />
                <h3 className="font-display font-bold text-lg text-[#0c1d2d]">
                  Security Credentials
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div>
                  <div className="font-display font-bold text-xs uppercase text-slate-700">
                    Account Password
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Keep your account secure with regular updates.
                  </div>
                </div>

                <Link
                  to="/update-password"
                  className="inline-flex items-center gap-2 text-xs font-display font-bold text-[#0c1d2d] hover:text-[#2563eb] border border-slate-200 rounded-lg bg-white px-3.5 py-2 shadow-xs transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Change Password →</span>
                </Link>
              </div>
            </section>

            {/* 3. Preferences */}
            <section className="bg-white border border-[#0c1d2d]/12 rounded-2xl shadow-xs p-6 sm:p-7">
              <div className="border-b border-slate-100 pb-3 mb-5 flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-slate-700" />
                <h3 className="font-display font-bold text-lg text-[#0c1d2d]">
                  Arena Preferences
                </h3>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-xs uppercase text-slate-700">
                    Reduced Motion Compliance
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Automatically adapts to system prefers-reduced-motion settings.
                  </div>
                </div>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                  Auto Enabled
                </span>
              </div>
            </section>

            {/* 4. Session & Destructive Logout */}
            <section className="bg-rose-50/40 border border-rose-200/70 rounded-2xl shadow-xs p-6 sm:p-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-display font-bold text-base text-rose-900">
                    Log out of Arena Session
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    End your current session on this browser device.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{loggingOut ? 'Logging out...' : 'Log Out Now'}</span>
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
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEmailModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white border border-[#0c1d2d]/15 rounded-2xl shadow-xl p-6 sm:p-7 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
              <div className="font-display font-bold text-base text-[#0c1d2d]">
                {otpStep ? 'Verify Email Code' : 'Link Recovery Email'}
              </div>
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailModalError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{emailModalError}</span>
              </div>
            )}

            {emailModalSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{emailModalSuccess}</span>
              </div>
            )}

            {!otpStep ? (
              <form onSubmit={handleInitiateEmailLink} className="space-y-4">
                <p className="text-xs font-body text-slate-600">
                  Enter your real email address. We will send a 6-digit OTP code to verify ownership.
                </p>

                <div>
                  <label
                    htmlFor="modal-email-input"
                    className="block mb-1.5 text-xs font-display font-bold tracking-wider text-slate-700 uppercase"
                  >
                    Email Address
                  </label>
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-xs focus-within:border-[#0c1d2d] focus-within:ring-1 focus-within:ring-[#0c1d2d] overflow-hidden">
                    <span className="px-3.5 py-2.5 border-r border-slate-100 bg-slate-50 text-slate-500 flex items-center">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      id="modal-email-input"
                      type="email"
                      placeholder="yourname@gmail.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                      autoFocus
                      className="w-full py-2.5 px-3 outline-none font-display font-semibold text-sm bg-transparent placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={emailLoading}
                  className="w-full py-3 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border border-[#0c1d2d]/20 rounded-xl shadow-xs font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  <span>{emailLoading ? 'Sending code...' : 'Send Verification Code'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-xs font-body text-slate-600">
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
                    className="w-full py-3 px-4 text-center font-mono font-bold text-2xl tracking-[0.4em] bg-slate-50 border border-slate-200 rounded-xl shadow-xs outline-none focus:border-[#0c1d2d] focus:ring-1 focus:ring-[#0c1d2d]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={emailLoading || otpCode.length < 6}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  <span>{emailLoading ? 'Verifying...' : 'Verify & Link Email'}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={emailLoading}
                    className="text-xs font-display font-medium text-slate-600 hover:text-slate-900 underline cursor-pointer flex items-center gap-1"
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
                    className="text-xs font-display font-medium text-slate-600 hover:text-slate-900 underline cursor-pointer"
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
