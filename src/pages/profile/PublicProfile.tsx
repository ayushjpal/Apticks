import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Zap,
  Flame,
  Trophy,
  UserCheck,
  UserPlus,
  Ban,
  ShieldAlert,
  Loader2,
  AlertCircle,
  BarChart2,
  CheckCircle2,
  ExternalLink,
  Check,
  X,
  UserMinus,
  Clock,
  HeartHandshake,
  Swords,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import {
  SocialService,
  type PublicUserProfile,
} from '../../services/socialService'
import { MountainSilhouetteSvg } from './components/MountainSilhouetteSvg'

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [userNotFound, setUserNotFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Block Modal State
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [blockSubmitting, setBlockSubmitting] = useState(false)

  // Remove Friend Modal State
  const [removeFriendModalOpen, setRemoveFriendModalOpen] = useState(false)
  const [removeFriendSubmitting, setRemoveFriendSubmitting] = useState(false)

  // Toast / Status banner
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  // Load public profile
  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      if (!username) {
        setUserNotFound(true)
        setLoading(false)
        return
      }

      setLoading(true)
      setUserNotFound(false)
      setErrorMessage(null)

      try {
        const res = await SocialService.getPublicProfile(username)
        if (!isMounted) return

        if (res.success && res.found && res.profile) {
          setProfile(res.profile)
        } else {
          setUserNotFound(true)
          setErrorMessage(res.message || 'Competitor unavailable')
        }
      } catch (err: unknown) {
        if (!isMounted) return
        setUserNotFound(true)
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [username])

  // Follow / Unfollow Toggle
  const handleToggleFollow = async () => {
    if (!profile || actionLoading || profile.is_caller) return
    setActionLoading(true)
    try {
      const res = await SocialService.toggleFollowUser(profile.id)
      if (res.success) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                is_following: res.following,
                followers_count: res.following
                  ? prev.followers_count + 1
                  : Math.max(0, prev.followers_count - 1),
              }
            : null
        )
        showToast(res.following ? `Now following @${profile.username}` : `Unfollowed @${profile.username}`)
      } else {
        showToast(res.message || 'Action failed', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Send Friend Request
  const handleSendFriendRequest = async () => {
    if (!profile || actionLoading || profile.is_caller) return
    setActionLoading(true)
    try {
      const res = await SocialService.sendFriendRequest(profile.id)
      if (res.success) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendship_status: 'outgoing_pending',
                friend_request_id: res.request_id || null,
              }
            : null
        )
        showToast(`Friend request sent to @${profile.username}`)
      } else {
        showToast(res.message || 'Failed to send friend request', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Accept Friend Request
  const handleAcceptFriendRequest = async () => {
    if (!profile || !profile.friend_request_id || actionLoading) return
    setActionLoading(true)
    try {
      const res = await SocialService.respondToFriendRequest(profile.friend_request_id, 'accept')
      if (res.success) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendship_status: 'friend',
                friends_count: prev.friends_count + 1,
              }
            : null
        )
        showToast(`You and @${profile.username} are now friends!`)
      } else {
        showToast(res.message || 'Failed to accept friend request', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Reject Friend Request
  const handleRejectFriendRequest = async () => {
    if (!profile || !profile.friend_request_id || actionLoading) return
    setActionLoading(true)
    try {
      const res = await SocialService.respondToFriendRequest(profile.friend_request_id, 'reject')
      if (res.success) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendship_status: 'none',
                friend_request_id: null,
              }
            : null
        )
        showToast('Friend request declined.')
      } else {
        showToast(res.message || 'Failed to decline request', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Cancel Outgoing Friend Request
  const handleCancelFriendRequest = async () => {
    if (!profile || !profile.friend_request_id || actionLoading) return
    setActionLoading(true)
    try {
      const res = await SocialService.cancelFriendRequest(profile.friend_request_id)
      if (res.success) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendship_status: 'none',
                friend_request_id: null,
              }
            : null
        )
        showToast('Friend request cancelled.')
      } else {
        showToast(res.message || 'Failed to cancel request', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Remove Friend
  const handleRemoveFriendConfirm = async () => {
    if (!profile || removeFriendSubmitting) return
    setRemoveFriendSubmitting(true)
    try {
      const res = await SocialService.removeFriend(profile.id)
      setRemoveFriendModalOpen(false)
      if (res.success) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                friendship_status: 'none',
                friend_request_id: null,
                friends_count: Math.max(0, prev.friends_count - 1),
              }
            : null
        )
        showToast(`Removed @${profile.username} from friends.`)
      } else {
        showToast(res.message || 'Failed to remove friend', 'error')
      }
    } finally {
      setRemoveFriendSubmitting(false)
    }
  }

  // Block Action
  const handleBlockConfirm = async () => {
    if (!profile || blockSubmitting) return
    setBlockSubmitting(true)
    try {
      const res = await SocialService.blockUser(profile.id)
      setBlockModalOpen(false)
      if (res.success) {
        showToast(`@${profile.username} blocked. Redirecting to Social Hub...`)
        setTimeout(() => {
          navigate('/social?tab=blocked')
        }, 1200)
      } else {
        showToast(res.message || 'Failed to block user', 'error')
      }
    } finally {
      setBlockSubmitting(false)
    }
  }

  // Unblock Action
  const handleUnblock = async () => {
    if (!profile || actionLoading) return
    setActionLoading(true)
    try {
      const res = await SocialService.unblockUser(profile.id)
      if (res.success) {
        setProfile((prev) => (prev ? { ...prev, is_blocked_by_caller: false } : null))
        showToast(`@${profile.username} unblocked.`)
      } else {
        showToast(res.message || 'Failed to unblock user', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // 1. Loading State
  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#071a2b] text-white flex items-center justify-center arena-bg-grid">
          <div className="text-center p-8 bg-[#091522] border border-white/10 rounded-2xl shadow-xl">
            <Loader2 className="w-8 h-8 animate-spin text-[#ffd43b] mx-auto mb-3" />
            <p className="font-mono text-sm text-slate-400">Loading competitor telemetry...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  // 2. User Not Found or Unavailable
  if (userNotFound || !profile) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-[#071a2b] text-white flex items-center justify-center p-4 arena-bg-grid">
          <div className="max-w-md w-full bg-[#091522] border-2 border-white/10 rounded-2xl p-8 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h1 className="font-display font-black text-2xl text-white uppercase tracking-tight">
              COMPETITOR UNAVAILABLE
            </h1>

            <p className="font-body text-xs sm:text-sm text-slate-400 leading-relaxed">
              The competitor handle <span className="font-mono text-amber-400">@{username}</span> could not be found, has been deactivated, or is currently unavailable in the Apticks network.
            </p>
            {errorMessage && (
              <p className="font-mono text-[11px] text-slate-500">Reason: {errorMessage}</p>
            )}

            <div className="pt-2">
              <Link
                to="/social"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Social Hub</span>
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  const displayName = profile.display_name?.trim() || profile.username
  const firstLetter = displayName.charAt(0).toUpperCase()
  const levelNum = profile.level || 1
  const levelStr = String(levelNum).padStart(2, '0')
  const tierTitle = profile.level_title || 'NOVICE'
  const currentXp = profile.xp_in_level || 0
  const nextLevelSpan = profile.next_level_xp - profile.current_level_xp
  const progressPercent = profile.progress_percentage || 0
  const xpRequired = profile.xp_required || 0
  const nextLevelNum = String(levelNum + 1).padStart(2, '0')

  return (
    <AppLayout>
      <div className="min-h-screen bg-[#071a2b] text-white py-6 sm:py-8 arena-bg-grid">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Back Navigation Row */}
          <div className="flex items-center justify-between gap-4">
            <Link
              to="/social"
              className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Social Hub</span>
            </Link>

            {profile.is_caller && (
              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#ffd43b]/10 text-[#ffd43b] border border-[#ffd43b]/30 rounded-xl font-mono text-xs font-bold hover:bg-[#ffd43b]/20 transition-all"
              >
                <span>Edit Private Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* Self Profile Notice */}
          {profile.is_caller && (
            <div className="p-3.5 bg-sky-500/10 border border-sky-500/30 rounded-xl flex items-center justify-between gap-3 text-xs font-mono text-sky-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>You are previewing your public competitor profile as seen by other members.</span>
              </div>
              <Link to="/profile" className="underline font-bold hover:text-white shrink-0">
                Go to Self Profile →
              </Link>
            </div>
          )}

          {/* Toast Notification */}
          {toast && (
            <div
              className={`p-3.5 rounded-xl border font-mono text-xs flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-2 ${
                toast.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{toast.text}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PROFILE HEADER CARD                                                       */}
          {/* ========================================================================= */}
          <div className="bg-[#091522] border border-white/10 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            {/* Left: Avatar & Identity */}
            <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0 flex-1">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0d1e30] border-2 border-white/15 flex items-center justify-center font-display font-black text-2xl sm:text-3xl text-white overflow-hidden shrink-0 shadow-lg">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{firstLetter}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight leading-none truncate">
                    {displayName}
                  </h1>
                  <span className="font-mono text-xs sm:text-sm font-medium text-slate-400 truncate">
                    @{profile.username}
                  </span>
                </div>

                {/* Social Network Counts (Friends, Followers, Following, Streak) */}
                <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs font-mono text-slate-300 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <strong className="text-white font-bold">{profile.friends_count}</strong>
                    <span className="text-slate-400">Friends</span>
                  </span>
                  <span className="text-white/20">•</span>
                  <span className="flex items-center gap-1.5">
                    <strong className="text-white font-bold">{profile.followers_count}</strong>
                    <span className="text-slate-400">Followers</span>
                  </span>
                  <span className="text-white/20">•</span>
                  <span className="flex items-center gap-1.5">
                    <strong className="text-white font-bold">{profile.following_count}</strong>
                    <span className="text-slate-400">Following</span>
                  </span>
                  {profile.current_streak > 0 && (
                    <>
                      <span className="text-white/20">•</span>
                      <span className="flex items-center gap-1 font-semibold text-amber-300">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        <span>{profile.current_streak}d Streak</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Bio Statement */}
                <p className="font-body text-xs sm:text-sm text-slate-400 italic mt-2.5 leading-relaxed line-clamp-2 max-w-2xl">
                  {profile.bio && profile.bio.trim()
                    ? `"${profile.bio.trim()}"`
                    : '"Competitor sharpening speed and cognitive stamina in the Apticks arena."'}
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            {!profile.is_caller && (
              <div className="flex items-center gap-2.5 self-start sm:self-center shrink-0 flex-wrap">
                {profile.is_blocked_by_caller ? (
                  <button
                    type="button"
                    onClick={handleUnblock}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? 'Unblocking...' : 'Unblock Competitor'}
                  </button>
                ) : (
                  <>
                    {/* FRIEND STATUS ACTIONS */}
                    {profile.friendship_status === 'friend' && (
                      <div className="flex items-center gap-1.5">
                        <span className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono font-bold flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          <span>Friends</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setRemoveFriendModalOpen(true)}
                          disabled={actionLoading}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-white/10 hover:border-rose-500/20 transition-all cursor-pointer"
                          title="Remove Friend"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {profile.friendship_status === 'incoming_pending' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleAcceptFriendRequest}
                          disabled={actionLoading}
                          className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black border border-black shadow-[2px_2px_0_#000] rounded-xl text-xs font-display font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept Request</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRejectFriendRequest}
                          disabled={actionLoading}
                          className="p-2 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/20 rounded-xl text-xs font-mono transition-all disabled:opacity-50 cursor-pointer"
                          title="Decline Request"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {profile.friendship_status === 'outgoing_pending' && (
                      <div className="flex items-center gap-1.5">
                        <span className="px-3 py-2 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Request Sent</span>
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelFriendRequest}
                          disabled={actionLoading}
                          className="px-2.5 py-2 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/20 rounded-xl text-xs font-mono transition-all disabled:opacity-50 cursor-pointer"
                          title="Cancel Request"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {profile.friendship_status === 'none' && (
                      <button
                        type="button"
                        onClick={handleSendFriendRequest}
                        disabled={actionLoading}
                        className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/15 hover:border-white/30 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                        title="Add Friend"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-sky-400" />
                        <span>Add Friend</span>
                      </button>
                    )}

                    {/* FOLLOW TOGGLE BUTTON */}
                    <button
                      type="button"
                      onClick={handleToggleFollow}
                      disabled={actionLoading}
                      className={`px-3.5 py-2 rounded-xl text-xs font-display font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                        profile.is_following
                          ? 'bg-white/10 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-white/15 hover:border-rose-500/30'
                          : 'bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border border-black shadow-[2px_2px_0_#0c1d2d]'
                      }`}
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : profile.is_following ? (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>

                    {/* 1v1 CHALLENGE BUTTON */}
                    <button
                      type="button"
                      onClick={() => navigate(`/1v1?challenge=${profile.username}`)}
                      className="px-3.5 py-2 bg-gradient-to-r from-amber-500/20 to-[#ffd43b]/20 hover:from-amber-500/30 hover:to-[#ffd43b]/30 text-[#ffd43b] border border-[#ffd43b]/40 rounded-xl text-xs font-display font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#ffd43b]/20"
                      title="Challenge to 1v1 Battle"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>Challenge 1v1</span>
                    </button>

                    {/* BLOCK BUTTON */}
                    <button
                      type="button"
                      onClick={() => setBlockModalOpen(true)}
                      disabled={actionLoading}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-white/10 hover:border-rose-500/30 transition-all cursor-pointer"
                      title="Block Competitor"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* COMPETITIVE HERO CARD                                                     */}
          {/* ========================================================================= */}
          <div className="bg-[#091522] border border-white/10 rounded-2xl lg:rounded-3xl p-5 sm:p-6 relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch relative z-10">
              {/* LEVEL & PROGRESSION */}
              <div className="lg:col-span-5 flex flex-col justify-between relative min-h-[220px] pb-1 lg:border-r lg:border-white/10 lg:pr-8">
                <MountainSilhouetteSvg className="absolute -right-2 -top-1 w-56 sm:w-64 h-32 opacity-40 lg:opacity-50" />

                <div>
                  <div className="relative z-10">
                    <div className="font-display font-black text-3xl sm:text-4xl tracking-tight leading-none">
                      <span className="text-white">LEVEL </span>
                      <span className="text-sky-400">{levelStr}</span>
                    </div>
                    <div className="font-mono text-xs sm:text-sm font-bold tracking-[0.2em] text-amber-400 uppercase mt-1.5">
                      {tierTitle}
                    </div>
                  </div>

                  {/* Level Progress Bar */}
                  <div className="mt-8 sm:mt-10">
                    <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                      <span className="font-bold text-slate-300">
                        {currentXp} / {nextLevelSpan > 0 ? nextLevelSpan : 100} XP
                      </span>
                      <span className="font-bold text-slate-300">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800/80 border border-white/10 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500/80 to-amber-400/80 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 font-medium">NEXT MILESTONE</span>
                  <span className="text-slate-200 font-bold">
                    <span className="text-amber-300">{xpRequired} XP</span> TO LEVEL {nextLevelNum}
                  </span>
                </div>
              </div>

              {/* COMPETITIVE SUMMARY HUD */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-sky-400" />
                    <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                      ARENA RANKING & XP
                    </h2>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">SERVER AUTHORITATIVE</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Global Rank */}
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 flex flex-col justify-between">
                    <div className="font-mono font-black text-2xl sm:text-3xl text-white">
                      {profile.rank !== null ? `#${profile.rank}` : 'UNRANKED'}
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mt-1 flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-[#ffd43b]" />
                      <span>GLOBAL ARENA RANK</span>
                    </span>
                  </div>

                  {/* Total Unified XP */}
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 flex flex-col justify-between">
                    <div className="font-mono font-black text-2xl sm:text-3xl text-[#ffd43b] flex items-center gap-1.5">
                      <Zap className="w-6 h-6 fill-[#ffd43b]" />
                      <span>{profile.total_xp}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mt-1">
                      TOTAL UNIFIED XP
                    </span>
                  </div>
                </div>

                {/* Contests Count Banner */}
                <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">CONTESTS PARTICIPATED</span>
                  <span className="text-white font-bold">{profile.contests_count} Arena Battles</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PERFORMANCE BREAKDOWN                                                     */}
          {/* ========================================================================= */}
          <div className="bg-[#091522] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-sky-400" />
              <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                PERFORMANCE METRICS
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Total Solved */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
                <span className="font-mono font-black text-xl sm:text-2xl text-white block">
                  {profile.solved_count}
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mt-1 block">
                  SOLVED QUESTIONS
                </span>
              </div>

              {/* Accuracy */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
                <span className="font-mono font-black text-xl sm:text-2xl text-emerald-400 block">
                  {profile.accuracy_percentage}%
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mt-1 block">
                  ACCURACY RATE
                </span>
              </div>

              {/* Correct Attempts */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
                <span className="font-mono font-black text-xl sm:text-2xl text-emerald-400 block">
                  {profile.correct_attempts}
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mt-1 block">
                  CORRECT SUBMISSIONS
                </span>
              </div>

              {/* Total Attempts */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
                <span className="font-mono font-black text-xl sm:text-2xl text-slate-300 block">
                  {profile.total_attempts}
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mt-1 block">
                  TOTAL ATTEMPTS
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Remove Friend Confirmation Modal */}
      {removeFriendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#091522] border-2 border-white/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-white">
                  Remove Friend @{profile.username}?
                </h3>
                <span className="font-mono text-[11px] text-slate-400">Mutual Friendship Disconnection</span>
              </div>
            </div>

            <p className="font-body text-xs text-slate-300 leading-relaxed">
              Are you sure you want to remove <span className="font-mono text-white font-bold">@{profile.username}</span> from your friends list? Your follow relationships will remain unaffected.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRemoveFriendModalOpen(false)}
                disabled={removeFriendSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveFriendConfirm}
                disabled={removeFriendSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-display font-bold tracking-wide transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {removeFriendSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Remove Friend</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {blockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#091522] border-2 border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-white">
                  Block @{profile.username}?
                </h3>
                <span className="font-mono text-[11px] text-rose-300">Irreversible Mutual Isolation</span>
              </div>
            </div>

            <p className="font-body text-xs text-slate-300 leading-relaxed">
              Blocking will automatically remove any mutual follows and friendships, prevent future 1v1 challenges, and hide each other from social discovery and public profile view.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setBlockModalOpen(false)}
                disabled={blockSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBlockConfirm}
                disabled={blockSubmitting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-display font-bold tracking-wide transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {blockSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Blocking...</span>
                  </>
                ) : (
                  <span>Block Competitor</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
