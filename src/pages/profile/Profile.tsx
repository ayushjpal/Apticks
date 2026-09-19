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
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Sliders,
  BarChart2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  ProfileService,
  type UserProfile,
  type UsernameCooldownInfo,
} from '../../services/profileService'
import { SocialService } from '../../services/socialService'
import { normalizeUsername } from '../../utils/validation'
import { QuestionService } from '../../services/questionService'
import { StreakService } from '../../services/streakService'
import { LeaderboardService } from '../../services/leaderboardService'
import { calculateLevelProgress, type LevelProgress } from '../../utils/levelEngine'
import type { QuestionBankStats, UserQuestionAttempt, UserStreak } from '../../types/questions'
import AppLayout from '../../components/layout/AppLayout'

// Subcomponents matching reference design
import { ProfileHeader } from './components/ProfileHeader'
import { CompetitiveHeroCard } from './components/CompetitiveHeroCard'
import { RecentActivityFeed, type DailyChallengeCompletionRow } from './components/RecentActivityFeed'
import { ProgressOverviewHeatmap } from './components/ProgressOverviewHeatmap'

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

type ProfileTab = 'overview' | 'activity' | 'edit' | 'settings'

export default function Profile() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Active View Tab: 'overview' | 'activity' | 'edit' | 'settings'
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview')

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
  const [challengeCompletions, setChallengeCompletions] = useState<DailyChallengeCompletionRow[]>([])
  const [userStreak, setUserStreak] = useState<UserStreak | null>(null)
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null)
  const [followersCount, setFollowersCount] = useState<number>(0)
  const [followingCount, setFollowingCount] = useState<number>(0)

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
  // 1. Initial Load: Authoritative, Real-Data Fetching
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
            dcCompsRes,
            followersCountRes,
            followingCountRes,
          ] = await Promise.all([
            QuestionService.getQuestionsWithProgress(user.id),
            QuestionService.getUserAttempts(user.id, 50),
            StreakService.getUserStreak(user.id),
            LeaderboardService.getUserGlobalRank(user.id),
            // Enhanced fetch for authentic Daily Challenge completion history
            supabase
              .from('user_daily_challenge_completions')
              .select('challenge_date, bonus_xp_awarded, completed_at')
              .eq('user_id', user.id)
              .order('challenge_date', { ascending: false })
              .limit(30),
            supabase
              .from('user_follows')
              .select('*', { count: 'exact', head: true })
              .eq('following_id', user.id),
            supabase
              .from('user_follows')
              .select('*', { count: 'exact', head: true })
              .eq('follower_id', user.id),
          ])

          let followersTotal = followersCountRes.count ?? 0
          let followingTotal = followingCountRes.count ?? 0

          // Fallback to SocialService if count query hit an unexpected error
          if ((followersCountRes.error || followingCountRes.error) && profile?.username) {
            try {
              const pubRes = await SocialService.getPublicProfile(profile.username)
              if (pubRes.found && pubRes.profile) {
                followersTotal = pubRes.profile.followers_count
                followingTotal = pubRes.profile.following_count
              }
            } catch (socErr) {
              console.warn('SocialService.getPublicProfile fallback error:', socErr)
            }
          }

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
            if (dcCompsRes && dcCompsRes.data) {
              setChallengeCompletions(dcCompsRes.data as DailyChallengeCompletionRow[])
            }
            setUserStreak(streak)
            setFollowersCount(followersTotal)
            setFollowingCount(followingTotal)
            if (rankRes.found && rankRes.levelProgress) {
              setLevelProgress(rankRes.levelProgress)
            } else {
              setLevelProgress(calculateLevelProgress(stats.totalPoints))
            }
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
    'Competitor'

  const effectiveUsername =
    usernameInput.trim() ||
    originalProfile?.username ||
    'player'

  const firstLetter = effectiveDisplayName.charAt(0).toUpperCase()

  return (
    <AppLayout maxWidth="narrow">
      <div className="space-y-5 animate-entry pb-10">
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

        {/* ========================================================= */}
        {/* 1. PROFILE HEADER (Compact Athlete Identity)              */}
        {/* ========================================================= */}
        <ProfileHeader
          displayName={effectiveDisplayName}
          username={effectiveUsername}
          avatarUrl={avatarUrl}
          bio={bio}
          streakDays={userStreak?.currentStreak ?? 1}
          division="Division 1"
          followersCount={followersCount}
          followingCount={followingCount}
          onEditProfile={() => setActiveTab(activeTab === 'edit' ? 'overview' : 'edit')}
          onOpenSettings={() => setActiveTab(activeTab === 'settings' ? 'overview' : 'settings')}
          onViewFollowers={() => navigate('/social?tab=followers')}
          onViewFollowing={() => navigate('/social?tab=following')}
          isSettingsActive={activeTab === 'settings'}
          isEditActive={activeTab === 'edit'}
        />

        {/* ========================================================= */}
        {/* 2. UNIFIED MAIN COMPETITIVE HERO CARD                     */}
        {/* Combines Level + Performance into One Hero Glass Panel    */}
        {/* ========================================================= */}
        {activeTab !== 'edit' && activeTab !== 'settings' && (
          <CompetitiveHeroCard
            levelProgress={levelProgress}
            questionStats={questionStats}
          />
        )}

        {/* ========================================================= */}
        {/* 3. NAVIGATION TABS BAR (Below Hero Card)                  */}
        {/* ========================================================= */}
        <div className="flex items-center gap-1.5 border-b border-white/10 pb-2.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`
              px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shrink-0
              ${
                activeTab === 'overview'
                  ? 'bg-white/10 text-white border border-white/15 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }
            `}
          >
            <User className="w-3.5 h-3.5" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`
              px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shrink-0
              ${
                activeTab === 'activity'
                  ? 'bg-white/10 text-white border border-white/15 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }
            `}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Activity</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/contests')}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shrink-0 text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Contests</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* VIEW 1: OVERVIEW (Recent Activity + Progress Overview)    */}
        {/* ========================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* 2-Column Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-stretch">
              {/* Left Column: Recent Activity Feed */}
              <RecentActivityFeed
                attempts={userAttempts}
                challengeCompletions={challengeCompletions}
              />

              {/* Right Column: Activity Heatmap */}
              <ProgressOverviewHeatmap
                attempts={userAttempts}
                challengeCompletions={challengeCompletions}
                totalEarnedXp={levelProgress?.totalXp ?? questionStats?.totalPoints ?? 0}
                totalProblems={questionStats?.solvedCount ?? questionStats?.totalAttempts ?? 0}
                streakDays={userStreak?.currentStreak ?? 1}
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: ACTIVITY TAB (Expanded Activity View)             */}
        {/* ========================================================= */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            <RecentActivityFeed
              attempts={userAttempts}
              challengeCompletions={challengeCompletions}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 4: EDIT PROFILE TAB                                  */}
        {/* ========================================================= */}
        {activeTab === 'edit' && (
          <div className="max-w-2xl bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 sm:p-8 text-white">
            <div className="border-b border-white/10 pb-4 mb-6">
              <div className="inline-block bg-sky-500/10 text-sky-400 border border-sky-400/30 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold tracking-wider uppercase mb-2">
                Customize Identity
              </div>
              <h2 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-white leading-tight">
                Edit Profile
              </h2>
              <p className="mt-1 text-xs font-body text-slate-400">
                Update your public handle, display name, avatar, and personal statement across Apticks.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 1. Avatar Uploader & Presets */}
              <div>
                <label className="block mb-2 text-xs font-display font-bold text-slate-300 uppercase tracking-wider">
                  Profile Avatar
                </label>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="w-16 h-16 bg-[#ffd43b] border border-amber-400/50 rounded-2xl shadow-lg flex items-center justify-center font-display font-bold text-2xl text-[#0c1d2d] overflow-hidden shrink-0">
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
                        className="px-3.5 py-2 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg font-display font-bold text-xs text-white shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
                      </button>

                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="px-3.5 py-2 bg-rose-950/40 text-rose-300 hover:bg-rose-950/60 border border-rose-500/30 rounded-lg font-display font-bold text-xs cursor-pointer transition-colors"
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
                <div className="mt-4 pt-3 border-t border-white/10">
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
                            ? 'border-amber-400 ring-2 ring-amber-400/40'
                            : 'border-white/15 hover:border-white/30'
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
                  className="block mb-1.5 text-xs font-display font-bold tracking-wider text-slate-300 uppercase"
                >
                  Display Name
                </label>
                <div className="flex items-center bg-black/40 border border-white/15 rounded-xl shadow-xs focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400 overflow-hidden">
                  <span className="px-3.5 py-2.5 border-r border-white/10 bg-white/5 text-slate-400 flex items-center">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="displayName"
                    type="text"
                    placeholder="e.g. Alex Sharma"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                    className="w-full py-2.5 px-3 outline-none font-display font-semibold text-sm bg-transparent text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* 3. Handle (14-day rule) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="username"
                    className="text-xs font-display font-bold tracking-wider text-slate-300 uppercase"
                  >
                    Username (Handle)
                  </label>

                  {usernameStatus && (
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                        usernameStatus.isCurrent
                          ? 'bg-white/10 text-slate-300 border-white/15'
                          : usernameStatus.available
                          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
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
                  <div className="mb-2 p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs font-body text-amber-200 flex items-start gap-2">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <strong>Handle locked:</strong> Usernames can only be changed once every 14 days. Available in{' '}
                      <strong>{cooldown.daysLeft} day(s)</strong> on{' '}
                      <strong>{cooldown.formattedNextChangeDate}</strong>.
                    </div>
                  </div>
                )}

                <div className="flex items-center bg-black/40 border border-white/15 rounded-xl shadow-xs focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400 overflow-hidden">
                  <span className="px-3.5 py-2.5 border-r border-white/10 bg-white/5 text-slate-400 font-display font-bold text-sm">
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
                    className="w-full py-2.5 px-3 outline-none font-display font-semibold text-sm bg-transparent text-white placeholder:text-slate-500 disabled:bg-white/5 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 4. Bio */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="bio"
                    className="text-xs font-display font-bold tracking-wider text-slate-300 uppercase"
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
                  className="w-full p-3 bg-black/40 border border-white/15 rounded-xl shadow-xs outline-none font-body text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
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
                className="w-full py-3 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border border-amber-400/50 rounded-xl shadow-[0_0_15px_rgba(255,212,59,0.25)] hover:shadow-[0_0_20px_rgba(255,212,59,0.4)] font-display font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <span>{saving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 5: SETTINGS & ACCOUNT SECURITY                       */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-5">
            {/* 1. Account / Recovery Email */}
            <section className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 sm:p-7 text-white">
              <div className="border-b border-white/10 pb-3 mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-5 h-5 text-amber-400" />
                  <h3 className="font-display font-bold text-lg text-white">
                    Account Email
                  </h3>
                </div>
                {isEmailVerified ? (
                  <span className="bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                    Verified
                  </span>
                ) : (
                  <span className="bg-amber-950/40 text-amber-300 border border-amber-500/30 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                    Unlinked
                  </span>
                )}
              </div>

              <div className="p-4 bg-white/[0.04] border border-white/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <div className="font-display font-bold text-xs uppercase text-slate-300 mb-0.5">
                    Recovery & Notification Email
                  </div>
                  <div className="font-body font-medium text-sm text-slate-200 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-slate-400" />
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
                  className="px-3.5 py-2 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border border-amber-400/50 rounded-lg font-display font-bold text-xs shadow-xs cursor-pointer transition-all active:scale-[0.98]"
                >
                  {isEmailVerified ? 'Change Email' : '+ Link Email'}
                </button>
              </div>

              <p className="text-xs font-body text-slate-400">
                A verified email enables password recovery and official contest notifications.
              </p>
            </section>

            {/* 2. Security & Password */}
            <section className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 sm:p-7 text-white">
              <div className="border-b border-white/10 pb-3 mb-5 flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-amber-400" />
                <h3 className="font-display font-bold text-lg text-white">
                  Security Credentials
                </h3>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/[0.04] border border-white/10 rounded-xl">
                <div>
                  <div className="font-display font-bold text-xs uppercase text-slate-300">
                    Account Password
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Keep your account secure with regular updates.
                  </div>
                </div>

                <Link
                  to="/update-password"
                  className="inline-flex items-center gap-2 text-xs font-display font-bold text-white hover:text-[#ffd43b] border border-white/15 rounded-lg bg-white/5 hover:bg-white/10 px-3.5 py-2 shadow-xs transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Change Password →</span>
                </Link>
              </div>
            </section>

            {/* 3. Preferences */}
            <section className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-6 sm:p-7 text-white">
              <div className="border-b border-white/10 pb-3 mb-5 flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-amber-400" />
                <h3 className="font-display font-bold text-lg text-white">
                  Arena Preferences
                </h3>
              </div>

              <div className="p-4 bg-white/[0.04] border border-white/10 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-display font-bold text-xs uppercase text-slate-300">
                    Reduced Motion Compliance
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Automatically adapts to system prefers-reduced-motion settings.
                  </div>
                </div>
                <span className="bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase">
                  Auto Enabled
                </span>
              </div>
            </section>

            {/* 4. Session & Destructive Logout */}
            <section className="bg-rose-950/20 border border-rose-500/30 rounded-2xl shadow-xl p-6 sm:p-7 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="font-display font-bold text-base text-rose-300">
                    Log out of Arena Session
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    End your current session on this browser device.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-display font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{loggingOut ? 'Signing out...' : 'Log Out'}</span>
                </button>
              </div>
            </section>
          </div>
        )}

        {/* ========================================================= */}
        {/* EMAIL LINKING / OTP MODAL DIALOG                          */}
        {/* ========================================================= */}
        {emailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-slate-900 border border-white/20 rounded-2xl shadow-2xl p-6 text-white relative animate-scale-up">
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center text-[#ffd43b]">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-white">
                    {otpStep ? 'Verify Email Code' : 'Link Real Email'}
                  </h3>
                  <p className="text-xs text-slate-400 font-body">
                    {otpStep
                      ? 'Enter the 6-digit confirmation code.'
                      : 'Connect your personal email for security.'}
                  </p>
                </div>
              </div>

              {emailModalError && (
                <div className="mb-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-200 text-xs font-body flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{emailModalError}</span>
                </div>
              )}

              {emailModalSuccess && (
                <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-200 text-xs font-body flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{emailModalSuccess}</span>
                </div>
              )}

              {!otpStep ? (
                <form onSubmit={handleInitiateEmailLink} className="space-y-4">
                  <div>
                    <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="alex.sharma@gmail.com"
                      required
                      className="w-full py-2.5 px-3.5 bg-black/40 border border-white/15 rounded-xl font-body text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="w-full py-2.5 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] font-display font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {emailLoading ? 'Sending Verification...' : 'Send Verification Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-display font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      6-Digit Code
                    </label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                      required
                      className="w-full py-2.5 px-3.5 bg-black/40 border border-white/15 rounded-xl font-mono text-center tracking-[0.3em] font-bold text-lg text-[#ffd43b] placeholder:text-slate-600 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={emailLoading}
                      className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Resend
                    </button>
                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="flex-1 py-2.5 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border border-amber-400/50 rounded-xl font-display font-bold text-xs uppercase tracking-wider shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {emailLoading ? 'Verifying...' : 'Verify Code'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
