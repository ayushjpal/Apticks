import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  UserCheck,
  UserPlus,
  Ban,
  ExternalLink,
  Zap,
  Check,
  X,
  UserMinus,
  Clock,
  HeartHandshake,
} from 'lucide-react'

export interface UserSocialCardData {
  id: string
  username: string
  display_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  level?: number
  level_title?: string
  total_xp?: number
  solved_count?: number
  is_caller?: boolean
  is_following?: boolean
  is_following_back?: boolean
  friendship_status?: 'none' | 'friend' | 'incoming_pending' | 'outgoing_pending'
  friend_request_id?: string | null
  friends_since?: string | null
}

export type UserSocialCardMode =
  | 'search'
  | 'following'
  | 'follower'
  | 'blocked'
  | 'friend'
  | 'incoming_request'
  | 'outgoing_request'

interface UserSocialCardProps {
  user: UserSocialCardData
  mode: UserSocialCardMode
  onToggleFollow?: (userId: string) => Promise<void> | void
  onBlock?: (userId: string, username: string) => Promise<void> | void
  onUnblock?: (userId: string) => Promise<void> | void
  onSendFriendRequest?: (userId: string) => Promise<void> | void
  onAcceptRequest?: (requestId: string) => Promise<void> | void
  onRejectRequest?: (requestId: string) => Promise<void> | void
  onCancelRequest?: (requestId: string) => Promise<void> | void
  onRemoveFriend?: (userId: string, username: string) => Promise<void> | void
}

export const UserSocialCard: React.FC<UserSocialCardProps> = ({
  user,
  mode,
  onToggleFollow,
  onBlock,
  onUnblock,
  onSendFriendRequest,
  onAcceptRequest,
  onRejectRequest,
  onCancelRequest,
  onRemoveFriend,
}) => {
  const [loadingAction, setLoadingAction] = useState(false)

  const displayName = user.display_name?.trim() || user.username
  const firstLetter = displayName.charAt(0).toUpperCase()

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onToggleFollow || loadingAction) return
    setLoadingAction(true)
    try {
      await onToggleFollow(user.id)
    } finally {
      setLoadingAction(false)
    }
  }

  const handleBlockClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (loadingAction) return
    if (mode === 'blocked') {
      if (!onUnblock) return
      setLoadingAction(true)
      try {
        await onUnblock(user.id)
      } finally {
        setLoadingAction(false)
      }
    } else {
      if (!onBlock) return
      await onBlock(user.id, user.username)
    }
  }

  const handleAddFriendClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onSendFriendRequest || loadingAction) return
    setLoadingAction(true)
    try {
      await onSendFriendRequest(user.id)
    } finally {
      setLoadingAction(false)
    }
  }

  const handleAcceptClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onAcceptRequest || !user.friend_request_id || loadingAction) return
    setLoadingAction(true)
    try {
      await onAcceptRequest(user.friend_request_id)
    } finally {
      setLoadingAction(false)
    }
  }

  const handleRejectClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onRejectRequest || !user.friend_request_id || loadingAction) return
    setLoadingAction(true)
    try {
      await onRejectRequest(user.friend_request_id)
    } finally {
      setLoadingAction(false)
    }
  }

  const handleCancelClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onCancelRequest || !user.friend_request_id || loadingAction) return
    setLoadingAction(true)
    try {
      await onCancelRequest(user.friend_request_id)
    } finally {
      setLoadingAction(false)
    }
  }

  const handleRemoveFriendClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onRemoveFriend || loadingAction) return
    await onRemoveFriend(user.id, user.username)
  }

  return (
    <div className="bg-[#091522] border border-white/10 hover:border-white/20 rounded-xl p-3.5 sm:p-4 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      {/* Left: Avatar + Identity */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link
          to={`/profile/${user.username}`}
          className="w-12 h-12 rounded-xl bg-[#0d1e30] border border-white/15 flex items-center justify-center font-display font-black text-lg text-white overflow-hidden shrink-0 transition-transform hover:scale-105"
        >
          {user.avatar_url ? (
            <img src={user.avatar_url} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span>{firstLetter}</span>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/profile/${user.username}`}
              className="font-display font-bold text-sm sm:text-base text-white hover:text-sky-400 transition-colors truncate"
            >
              {displayName}
            </Link>
            <span className="font-mono text-xs text-slate-400 truncate">
              @{user.username}
            </span>
            {user.is_caller && (
              <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[10px] font-mono font-bold uppercase border border-sky-500/20">
                You
              </span>
            )}
            {mode === 'follower' && user.is_following_back && (
              <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-300 text-[10px] font-mono font-medium border border-white/10">
                Follows you
              </span>
            )}
            {user.friendship_status === 'friend' && mode !== 'friend' && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/20 flex items-center gap-1">
                <HeartHandshake className="w-3 h-3" />
                <span>Friend</span>
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs font-mono text-slate-400 flex-wrap">
            {typeof user.level === 'number' && (
              <span className="flex items-center gap-1 text-slate-300">
                <span className="text-[#ffd43b] font-bold">LVL {String(user.level).padStart(2, '0')}</span>
                {user.level_title && (
                  <span className="text-slate-400 text-[11px]">({user.level_title})</span>
                )}
              </span>
            )}
            {typeof user.total_xp === 'number' && (
              <>
                <span className="text-white/20">•</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Zap className="w-3 h-3 text-[#ffd43b] fill-[#ffd43b]" />
                  <span>{user.total_xp} XP</span>
                </span>
              </>
            )}
            {typeof user.solved_count === 'number' && (
              <>
                <span className="text-white/20">•</span>
                <span className="text-slate-400">
                  {user.solved_count} solved
                </span>
              </>
            )}
          </div>

          {user.bio && (
            <p className="font-body text-xs text-slate-400 truncate mt-1 max-w-xl">
              {user.bio}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap justify-end">
        <Link
          to={`/profile/${user.username}`}
          className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg text-xs font-mono font-semibold flex items-center gap-1 transition-colors"
          title="View Public Profile"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Profile</span>
        </Link>

        {/* 1. BLOCKED MODE */}
        {mode === 'blocked' && (
          <button
            type="button"
            onClick={handleBlockClick}
            disabled={loadingAction}
            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            {loadingAction ? 'Unblocking...' : 'Unblock'}
          </button>
        )}

        {/* 2. INCOMING REQUEST MODE */}
        {mode === 'incoming_request' && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAcceptClick}
              disabled={loadingAction}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black border border-black shadow-[1.5px_1.5px_0_#000] rounded-lg text-xs font-display font-bold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept</span>
            </button>
            <button
              type="button"
              onClick={handleRejectClick}
              disabled={loadingAction}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 rounded-lg text-xs font-mono transition-all disabled:opacity-50 cursor-pointer"
              title="Decline Request"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 3. OUTGOING REQUEST MODE */}
        {mode === 'outgoing_request' && (
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-mono flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>Pending</span>
            </span>
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={loadingAction}
              className="px-2.5 py-1.5 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/30 rounded-lg text-xs font-mono transition-all disabled:opacity-50 cursor-pointer"
              title="Cancel Request"
            >
              <span>Cancel</span>
            </button>
          </div>
        )}

        {/* 4. FRIEND MODE */}
        {mode === 'friend' && (
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-lg text-xs font-mono font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>Friends</span>
            </span>
            {onRemoveFriend && (
              <button
                type="button"
                onClick={handleRemoveFriendClick}
                disabled={loadingAction}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                title="Remove Friend"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* 5. SEARCH / FOLLOWING / FOLLOWER MODES */}
        {['search', 'following', 'follower'].includes(mode) && !user.is_caller && (
          <>
            {/* Friend action button if available in search/following/follower */}
            {onSendFriendRequest && user.friendship_status === 'none' && (
              <button
                type="button"
                onClick={handleAddFriendClick}
                disabled={loadingAction}
                className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg text-xs font-mono flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
                title="Send Friend Request"
              >
                <UserPlus className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Add Friend</span>
              </button>
            )}

            {user.friendship_status === 'outgoing_pending' && (
              <span className="px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span className="hidden sm:inline">Requested</span>
              </span>
            )}

            {/* Follow Toggle Button */}
            {onToggleFollow && (
              <button
                type="button"
                onClick={handleFollowClick}
                disabled={loadingAction}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                  user.is_following
                    ? 'bg-white/10 hover:bg-rose-500/20 text-slate-200 hover:text-rose-300 border border-white/15 hover:border-rose-500/30'
                    : 'bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border border-black shadow-[1.5px_1.5px_0_#0c1d2d]'
                }`}
              >
                {user.is_following ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            )}

            {/* Block Button */}
            {onBlock && (
              <button
                type="button"
                onClick={handleBlockClick}
                disabled={loadingAction}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                title="Block User"
              >
                <Ban className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
