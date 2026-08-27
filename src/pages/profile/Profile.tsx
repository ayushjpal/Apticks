import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  ProfileService,
  type UserProfile,
  type UsernameCooldownInfo,
} from '../../services/profileService'
import { normalizeUsername } from '../../utils/validation'
import { QuestionService } from '../../services/questionService'
import type { QuestionBankStats } from '../../types/questions'
import './Profile.css'

// Curated neo-brutalist avatar presets (SVG Data URIs)
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

  // User & DB State
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Original Profile data
  const [originalProfile, setOriginalProfile] = useState<UserProfile | null>(null)
  const [questionStats, setQuestionStats] = useState<QuestionBankStats | null>(null)

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
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
          navigate('/login', { replace: true })
          return
        }

        if (!isMounted) return

        setUserId(user.id)

        // Determine email status (exclude internal system placeholders)
        const rawEmail = user.email || ''
        const isInternal =
          !rawEmail ||
          rawEmail.endsWith('@apticks.app') ||
          rawEmail.endsWith('@auth.apticks.internal') ||
          rawEmail.endsWith('@aptiverse.local')

        const verified = !isInternal && Boolean(user.email_confirmed_at)
        setIsEmailVerified(verified)
        setUserEmail(verified ? rawEmail : null)

        // Load profile from Service
        let profile = await ProfileService.fetchProfile(user.id)
        if (!profile?.username && user.user_metadata?.username) {
          profile = {
            id: user.id,
            username: user.user_metadata.username,
            display_name: user.user_metadata.display_name || user.user_metadata.username,
            avatar_url: profile?.avatar_url || null,
            bio: profile?.bio || null,
            username_changed_at: profile?.username_changed_at || null,
          }
        }

        console.log('[Profile Init] authUser.id:', user.id)
        console.log('[Profile Init] profile row returned from Supabase:', profile)
        console.log('[Profile Init] profile.username:', profile?.username)
        console.log('[Profile Init] currentUsername:', profile?.username)

        if (isMounted) {
          setOriginalProfile(profile)
          setDisplayName(profile?.display_name || '')
          setBio(profile?.bio || '')
          setAvatarUrl(profile?.avatar_url || null)
          setUsernameInput(profile?.username || '')

          console.log('[Profile Init] username state after initialization:', profile?.username || '')

          // Calculate 14-day username cooldown
          const coolInfo = ProfileService.getUsernameCooldownInfo(
            profile?.username_changed_at
          )
          setCooldown(coolInfo)

          if (profile?.username) {
            setUsernameStatus({
              available: false,
              isCurrent: true,
              message: 'This is your current username.',
            })
          }
        }

        // Load question stats
        try {
          const { questions, progressMap } =
            await QuestionService.getQuestionsWithProgress(user.id)
          const stats = QuestionService.calculateStats(questions, progressMap)
          if (isMounted) {
            setQuestionStats(stats)
          }
        } catch (qErr) {
          console.warn('Could not load profile question stats:', qErr)
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

      // If unchanged from original authenticated profile
      if (
        originalProfile?.username &&
        trimmed === normalizeUsername(originalProfile.username)
      ) {
        setUsernameStatus({
          available: false,
          isCurrent: true,
          message: 'This is your current username.',
        })
        return
      }

      // If cooldown is active, don't query
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

    // Client-side rate-limit guard
    if (isChangingUsername && !cooldown.canChange) {
      setErrorMessage(
        `Username can only be changed once every 14 days. Next change available on ${cooldown.formattedNextChangeDate}.`
      )
      setSaving(false)
      return
    }

    // Availability guard
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

        // Update cooldown info if username was changed
        if (isChangingUsername) {
          const newCooldown = ProfileService.getUsernameCooldownInfo(
            res.profile.username_changed_at
          )
          setCooldown(newCooldown)
        }

        // Auto-dismiss success alert after 4 seconds
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

    if (clean.endsWith('@apticks.app') || clean.endsWith('@auth.apticks.internal') || clean.endsWith('@aptiverse.local')) {
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
  // Render
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="prof-page flex items-center justify-center min-h-screen text-white">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-4 border-white/20 border-t-[#ffd43b] rounded-full animate-spin" />
          <p className="font-black tracking-wider text-sm">LOADING PROFILE...</p>
        </div>
      </div>
    )
  }

  const effectiveDisplayName =
    displayName.trim() ||
    originalProfile?.display_name ||
    originalProfile?.username ||
    'Aptitude Ace'

  const effectiveUsername =
    usernameInput.trim() ||
    originalProfile?.username ||
    'athlete'
  const firstLetter = effectiveDisplayName.charAt(0).toUpperCase()

  return (
    <div className="prof-page">
      <div className="prof-bg-grid" />

      {/* Main Container */}
      <div className="prof-container">
        {/* ================================================= */}
        {/* TOP HEADER                                        */}
        {/* ================================================= */}
        <header className="prof-header">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="prof-back-btn">
              ← DASHBOARD
            </Link>
            <div className="hidden sm:flex items-center gap-2">
              <span className="prof-badge-tag">SETTINGS</span>
              <span className="text-xs font-black text-white/50 tracking-widest uppercase">
                / USER PROFILE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/questions" className="prof-nav-link">
              QUESTION BANK →
            </Link>
          </div>
        </header>

        {/* ================================================= */}
        {/* ALERTS / NOTIFICATIONS                            */}
        {/* ================================================= */}
        {saveSuccess && (
          <div className="prof-alert-success">
            <div>
              <div className="font-black text-sm uppercase tracking-wide">
                [✓] PROFILE UPDATED SUCCESSFULLY
              </div>
              <div className="text-xs font-bold text-black/80 mt-0.5">
                Your profile picture, bio, and settings have been saved.
              </div>
            </div>
            <button
              onClick={() => setSaveSuccess(false)}
              className="text-xs font-black underline"
            >
              DISMISS
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="prof-alert-error">
            <div>
              <div className="font-black text-sm uppercase tracking-wide">
                [✕] UPDATE FAILED
              </div>
              <div className="text-xs font-bold text-white/90 mt-0.5">
                {errorMessage}
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs font-black underline text-white"
            >
              DISMISS
            </button>
          </div>
        )}

        {/* ================================================= */}
        {/* 2-COLUMN MAIN CONTENT                             */}
        {/* ================================================= */}
        <div className="prof-grid">
          {/* ----------------------------------------------- */}
          {/* LEFT COLUMN: EDIT FORM                          */}
          {/* ----------------------------------------------- */}
          <section className="prof-form-card">
            <div className="prof-card-header">
              <div className="prof-badge-primary">PROFILE INFORMATION</div>
              <h1 className="prof-title">EDIT PROFILE</h1>
              <p className="prof-subtitle">
                Customize how your identity appears across the leaderboard,
                contests, and discussions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 mt-6">
              {/* ----------------------------------------- */}
              {/* 1. PROFILE PICTURE / AVATAR               */}
              {/* ----------------------------------------- */}
              <div className="prof-section">
                <label className="prof-label">PROFILE PICTURE (PFP)</label>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mt-2">
                  {/* Current Avatar Display */}
                  <div className="prof-avatar-preview-box">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="prof-avatar-fallback">{firstLetter}</div>
                    )}
                  </div>

                  {/* Actions & File Input */}
                  <div className="flex-1 space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarFileChange}
                      accept="image/png, image/jpeg, image/webp, image/gif"
                      className="hidden"
                      id="avatar-file-input"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="prof-btn-secondary"
                      >
                        {uploadingAvatar ? 'UPLOADING...' : 'UPLOAD PHOTO'}
                      </button>

                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="prof-btn-danger"
                        >
                          REMOVE
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] font-bold text-black/60">
                      Recommended: Square JPG, PNG, or WebP under 5MB.
                    </p>
                  </div>
                </div>

                {/* Avatar Presets Bar */}
                <div className="mt-4 pt-4 border-t-2 border-black/10">
                  <div className="text-[11px] font-black uppercase text-black/60 mb-2">
                    OR CHOOSE A PRESET AVATAR:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPresetAvatar(preset.url)}
                        className={`prof-preset-btn ${
                          avatarUrl === preset.url ? 'active' : ''
                        }`}
                        title={preset.label}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-8 h-8 rounded-none"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ----------------------------------------- */}
              {/* 2. DISPLAY NAME                           */}
              {/* ----------------------------------------- */}
              <div className="prof-section">
                <label htmlFor="displayName" className="prof-label">
                  DISPLAY NAME
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Alex Sharma"
                  maxLength={50}
                  className="prof-input"
                />
                <span className="text-[10px] font-bold text-black/50 mt-1 block">
                  Your public name displayed in leaderboard rankings and contest
                  lobbies.
                </span>
              </div>

              {/* ----------------------------------------- */}
              {/* 3. INSTAGRAM-STYLE USERNAME (14-DAY RULE) */}
              {/* ----------------------------------------- */}
              <div className="prof-section">
                <div className="flex items-center justify-between">
                  <label htmlFor="username" className="prof-label">
                    USERNAME (HANDLE)
                  </label>

                  {/* Availability Badge */}
                  {usernameStatus && (
                    <span
                      className={`prof-status-badge ${
                        usernameStatus.isCurrent
                          ? 'current'
                          : usernameStatus.available
                          ? 'available'
                          : 'taken'
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

                {/* Cooldown Lock Warning Banner */}
                {!cooldown.canChange && (
                  <div className="prof-cooldown-box">
                    <div className="font-black text-xs uppercase text-[#926002]">
                      [LOCKED - USERNAME COOLDOWN]
                    </div>
                    <p className="text-xs font-bold text-black/80 mt-0.5">
                      You changed your username recently. To prevent impersonation,
                      usernames can only be changed once every 14 days. You can change
                      it again in{' '}
                      <strong>{cooldown.daysLeft} day(s)</strong> on{' '}
                      <strong>{cooldown.formattedNextChangeDate}</strong>.
                    </p>
                  </div>
                )}

                <div className="prof-input-wrapper">
                  <span className="prof-input-prefix">@</span>
                  <input
                    id="username"
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    disabled={!cooldown.canChange}
                    placeholder="your_handle"
                    maxLength={20}
                    className={`prof-input-with-prefix ${
                      !cooldown.canChange ? 'disabled' : ''
                    }`}
                  />
                </div>

                <div className="flex flex-col gap-1 mt-1.5">
                  <p className="text-[11px] font-bold text-black/60">
                    {usernameStatus?.message}
                  </p>
                  {cooldown.canChange && (
                    <p className="text-[10px] font-bold text-[#b45309]">
                      * Note: Changing your username will lock it for 14 days. Max 20 characters.
                    </p>
                  )}
                </div>
              </div>

              {/* ----------------------------------------- */}
              {/* 4. BIO EDITOR                             */}
              {/* ----------------------------------------- */}
              <div className="prof-section">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="bio" className="prof-label">
                    BIO
                  </label>
                  <span
                    className={`text-xs font-black ${
                      bio.length > 150 ? 'text-red-600' : 'text-black/60'
                    }`}
                  >
                    {bio.length} / 160
                  </span>
                </div>

                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share your goals, favorite aptitude topics, or college..."
                  maxLength={160}
                  rows={3}
                  className="prof-textarea"
                />
              </div>

              {/* ----------------------------------------- */}
              {/* 5. ACCOUNT EMAIL & SECURITY (OTP FLOW)    */}
              {/* ----------------------------------------- */}
              <div className="prof-section">
                <div className="flex items-center justify-between mb-1">
                  <label className="prof-label">ACCOUNT EMAIL & RECOVERY</label>
                  {isEmailVerified ? (
                    <span className="prof-email-status-verified">✓ EMAIL VERIFIED</span>
                  ) : (
                    <span className="prof-email-status-unlinked">⚠ NOT LINKED</span>
                  )}
                </div>

                <div className="prof-email-box">
                  {isEmailVerified ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-black text-sm text-[#071a2b] flex items-center gap-2">
                          <span>✉</span> {userEmail}
                        </div>
                        <p className="text-[11px] font-bold text-black/60 mt-0.5">
                          Verified recovery email. Used for secure password resets.
                        </p>
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
                        className="prof-btn-secondary text-xs"
                      >
                        CHANGE EMAIL
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-black text-sm text-[#991b1b]">
                          No recovery email linked
                        </div>
                        <p className="text-[11px] font-bold text-black/60 mt-0.5">
                          Add your Gmail / email to enable password recovery and account security.
                        </p>
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
                        className="prof-btn-secondary text-xs"
                        style={{ backgroundColor: '#ffd43b' }}
                      >
                        + ADD EMAIL
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ----------------------------------------- */}
              {/* SUBMIT BUTTON                             */}
              {/* ----------------------------------------- */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={
                    saving ||
                    (normalizeUsername(usernameInput) !==
                      normalizeUsername(originalProfile?.username || '') &&
                      (!usernameStatus?.available || !cooldown.canChange))
                  }
                  className="prof-submit-btn"
                >
                  {saving ? 'SAVING CHANGES...' : 'SAVE PROFILE CHANGES →'}
                </button>
              </div>
            </form>
          </section>

          {/* ----------------------------------------------- */}
          {/* RIGHT COLUMN: LIVE PROFILE CARD PREVIEW         */}
          {/* ----------------------------------------------- */}
          <aside className="prof-preview-col">
            <div className="prof-preview-sticky">
              <div className="prof-preview-header">
                <span className="font-black text-xs uppercase tracking-widest text-white/60">
                  LIVE PUBLIC PREVIEW
                </span>
                <span className="prof-badge-tag-amber">ATHLETE CARD</span>
              </div>

              {/* Neo-brutalist Athlete Card */}
              <div className="prof-card-preview">
                {/* Card Top Banner */}
                <div className="prof-card-topbar">
                  <span className="font-black text-[10px] tracking-widest text-black/60 uppercase">
                    APTIVERSE ATHLETE ID: #{userId?.slice(0, 6).toUpperCase()}
                  </span>
                  <span className="w-2.5 h-2.5 rounded-full bg-[#32e875] border-2 border-black animate-pulse" />
                </div>

                {/* Card Body */}
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Live Avatar */}
                    <div className="prof-preview-avatar">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Preview Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="prof-avatar-fallback text-2xl">
                          {firstLetter}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h2 className="font-black text-xl text-[#071a2b] truncate tracking-tight">
                        {effectiveDisplayName}
                      </h2>
                      <div className="font-black text-sm text-[#38aef0] tracking-tight">
                        @{effectiveUsername}
                      </div>
                      <div className="text-[10px] font-black text-black/50 uppercase mt-0.5">
                        ATHLETE MEMBER
                      </div>
                    </div>
                  </div>

                  {/* Bio Preview */}
                  <div className="prof-preview-bio-box">
                    <div className="text-[10px] font-black uppercase text-black/40 mb-1">
                      BIO / STATEMENT:
                    </div>
                    <p className="text-xs font-bold text-black/80 leading-relaxed italic">
                      {bio.trim()
                        ? `"${bio.trim()}"`
                        : '"AptiVerse problem solver sharpening aptitude & quantitative reasoning skills daily."'}
                    </p>
                  </div>

                  {/* Stats Row */}
                  <div className="prof-preview-stats">
                    <div className="prof-stat-box">
                      <div className="prof-stat-val text-[#38aef0]">
                        {questionStats?.solvedCount ?? 0}
                      </div>
                      <div className="prof-stat-lbl">PROBLEMS SOLVED</div>
                    </div>

                    <div className="prof-stat-box">
                      <div className="prof-stat-val text-[#32e875]">
                        {questionStats?.totalPoints ?? 0}
                      </div>
                      <div className="prof-stat-lbl">XP POINTS</div>
                    </div>

                    <div className="prof-stat-box">
                      <div className="prof-stat-val text-[#ffd43b]">
                        {questionStats?.accuracyRate ?? 0}%
                      </div>
                      <div className="prof-stat-lbl">ACCURACY</div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="prof-card-footer">
                  <div className="text-[10px] font-black tracking-widest text-black/60">
                    STATUS: ACTIVE ARENA PARTICIPANT
                  </div>
                </div>
              </div>

              {/* Quick Links Box */}
              <div className="prof-quick-box">
                <div className="font-black text-xs uppercase tracking-wide mb-2 text-white">
                  ACCOUNT SECURITY & SHORTCUTS
                </div>
                <div className="space-y-2">
                  <Link
                    to="/update-password"
                    className="prof-quick-link"
                  >
                    CHANGE PASSWORD →
                  </Link>
                  <Link
                    to="/questions"
                    className="prof-quick-link"
                  >
                    SOLVE PRACTICE QUESTIONS →
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ================================================= */}
      {/* IN-APP OTP EMAIL LINKING MODAL                     */}
      {/* ================================================= */}
      {emailModalOpen && (
        <div className="prof-modal-overlay" onClick={() => setEmailModalOpen(false)}>
          <div
            className="prof-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="prof-modal-header">
              <div className="font-black text-base text-[#071a2b] uppercase tracking-wide">
                {otpStep ? 'ENTER VERIFICATION CODE' : 'LINK ACCOUNT EMAIL'}
              </div>
              <button
                type="button"
                className="prof-modal-close-btn"
                onClick={() => setEmailModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {emailModalError && (
              <div className="p-3 mb-4 bg-[#ff5b5b] text-white border-2 border-black font-bold text-xs">
                {emailModalError}
              </div>
            )}

            {emailModalSuccess && (
              <div className="p-3 mb-4 bg-[#32e875] text-black border-2 border-black font-bold text-xs">
                {emailModalSuccess}
              </div>
            )}

            {!otpStep ? (
              <form onSubmit={handleInitiateEmailLink} className="space-y-4">
                <p className="text-xs font-bold text-black/75">
                  Enter your real email address. We will send a 6-digit OTP code to verify ownership.
                </p>

                <div>
                  <label htmlFor="modal-email-input" className="prof-label">
                    REAL EMAIL / GMAIL
                  </label>
                  <input
                    id="modal-email-input"
                    type="email"
                    placeholder="yourname@gmail.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    required
                    autoFocus
                    className="prof-input"
                  />
                </div>

                <div className="prof-otp-actions">
                  <button
                    type="submit"
                    disabled={emailLoading}
                    className="prof-submit-btn"
                  >
                    {emailLoading ? 'SENDING CODE...' : 'SEND VERIFICATION CODE →'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-xs font-bold text-black/75">
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
                    className="prof-otp-input"
                  />
                </div>

                <div className="prof-otp-actions">
                  <button
                    type="submit"
                    disabled={emailLoading || otpCode.length < 6}
                    className="prof-submit-btn"
                  >
                    {emailLoading ? 'VERIFYING...' : 'VERIFY & LINK EMAIL →'}
                  </button>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t-2 border-black/10">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={emailLoading}
                      className="text-xs font-black underline text-black/70 hover:text-black cursor-pointer bg-transparent border-none p-0"
                    >
                      ↻ Resend Code
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep(false)
                        setOtpCode('')
                        setEmailModalError(null)
                        setEmailModalSuccess(null)
                      }}
                      className="text-xs font-black underline text-black/70 hover:text-black cursor-pointer bg-transparent border-none p-0"
                    >
                      Use Different Email
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
