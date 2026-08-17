import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  ProfileService,
  type UserProfile,
  type UsernameCooldownInfo,
} from '../../services/profileService'
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
        setUserEmail(user.email || null)

        // Load profile from Service
        const profile = await ProfileService.fetchProfile(user.id)
        if (isMounted) {
          setOriginalProfile(profile)
          setDisplayName(profile?.display_name || '')
          setBio(profile?.bio || '')
          setAvatarUrl(profile?.avatar_url || null)
          setUsernameInput(profile?.username || '')

          // Calculate 14-day username cooldown
          const coolInfo = ProfileService.getUsernameCooldownInfo(
            profile?.username_changed_at
          )
          setCooldown(coolInfo)

          if (profile?.username) {
            setUsernameStatus({
              available: true,
              isCurrent: true,
              message: 'Current username',
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
      } catch (err: any) {
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

    const trimmed = usernameInput.trim().toLowerCase()
    if (!trimmed) {
      setUsernameStatus({
        available: false,
        isCurrent: false,
        message: 'Username cannot be empty',
      })
      return
    }

    // If unchanged from original
    if (
      originalProfile?.username &&
      trimmed === originalProfile.username.trim().toLowerCase()
    ) {
      setUsernameStatus({
        available: true,
        isCurrent: true,
        message: 'Current username',
      })
      return
    }

    // If cooldown is active, don't query
    if (!cooldown.canChange) {
      return
    }

    setCheckingUsername(true)
    const timeoutId = setTimeout(async () => {
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
    }, 450)

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
    } catch (err: any) {
      setErrorMessage(err.message || 'Error uploading profile picture.')
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
      usernameInput.trim().toLowerCase() !==
      (originalProfile?.username || '').trim().toLowerCase()

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
    } catch (err: any) {
      setErrorMessage(err.message || 'Unexpected error while updating profile.')
    } finally {
      setSaving(false)
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
    displayName.trim() || originalProfile?.username || 'Aptitude Ace'
  const effectiveUsername = usernameInput.trim() || 'user'
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
                    maxLength={30}
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
                      * Note: Changing your username will lock it for 14 days.
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
              {/* SUBMIT BUTTON                             */}
              {/* ----------------------------------------- */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={saving || (usernameInput.trim().toLowerCase() !== (originalProfile?.username || '').trim().toLowerCase() && (!usernameStatus?.available || !cooldown.canChange))}
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
                        {userEmail || 'AUTHENTICATED MEMBER'}
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
    </div>
  )
}
