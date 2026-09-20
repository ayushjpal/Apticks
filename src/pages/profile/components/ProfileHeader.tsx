import React from 'react'
import { Link } from 'react-router-dom'
import { Flame, Edit3, Settings } from 'lucide-react'

interface ProfileHeaderProps {
  displayName: string
  username: string
  avatarUrl: string | null
  bio?: string | null
  streakDays?: number
  division?: string
  friendsCount?: number
  onEditProfile: () => void
  onOpenSettings: () => void
  isSettingsActive?: boolean
  isEditActive?: boolean
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  displayName,
  username,
  avatarUrl,
  bio,
  streakDays = 1,
  division = 'Division 1',
  friendsCount = 0,
  onEditProfile,
  onOpenSettings,
  isSettingsActive = false,
  isEditActive = false,
}) => {
  const firstLetter = (displayName || username || 'A').charAt(0).toUpperCase()

  // Only consider authentic user uploads as custom avatars, replacing generic bot/dicebear avatars
  const isCustomUpload = Boolean(
    avatarUrl &&
      !avatarUrl.includes('dicebear.com') &&
      !avatarUrl.includes('bottts')
  )

  const statement =
    bio && bio.trim()
      ? `"${bio.trim()}"`
      : '"Apticks competitor sharpening quantitative speed and logical reasoning daily."'

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
      {/* Left: Avatar + Details */}
      <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
        {/* Flat Geometric Initials Avatar */}
        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-[#0d1e30] border border-white/15 flex items-center justify-center font-display font-black text-2xl sm:text-3xl text-white overflow-hidden select-none shrink-0">
          {isCustomUpload && avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span>{firstLetter}</span>
          )}
        </div>

        {/* Identity Info */}
        <div className="min-w-0 flex-1">
          {/* Name & Handle (Primary Identity) */}
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight leading-none truncate">
              {displayName || username || 'Competitor'}
            </h1>
            <span className="font-mono text-xs sm:text-sm font-medium text-slate-400 truncate">
              @{username || 'competitor'}
            </span>
          </div>

          {/* Secondary Metadata Row (Division & Streak) */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs">
            <span className="font-mono text-slate-300 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>{division}</span>
            </span>
            <span className="text-white/20">|</span>
            {streakDays > 0 ? (
              <span className="font-mono font-semibold text-amber-300/90 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>{streakDays}d Streak</span>
              </span>
            ) : (
              <span className="font-mono text-slate-400">0d Streak</span>
            )}
          </div>

          {/* Friends Count Row linking to /social?tab=friends */}
          <div className="flex items-center gap-3.5 mt-2 text-xs font-mono">
            <Link
              to="/social?tab=friends"
              className="group inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <span className="text-slate-400 group-hover:text-slate-300">Friends</span>
              <strong className="font-bold text-white group-hover:text-[#ffd43b] transition-colors">{friendsCount}</strong>
            </Link>
          </div>

          {/* Operational Statement / Bio */}
          <p className="font-body text-xs sm:text-sm text-slate-400 italic mt-2 leading-relaxed line-clamp-2 max-w-2xl">
            {statement}
          </p>
        </div>
      </div>

      {/* Right: Settings & Edit Profile Buttons */}
      <div className="shrink-0 self-start sm:self-center flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          className={`px-3 py-2 border rounded-xl font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] ${
            isSettingsActive
              ? 'bg-white/15 text-white border-white/25 shadow-xs'
              : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border-white/10 hover:border-white/20'
          }`}
        >
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          <span>Settings</span>
        </button>

        <button
          type="button"
          onClick={onEditProfile}
          className={`px-3 py-2 border rounded-xl font-display font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-[0.98] ${
            isEditActive
              ? 'bg-white/15 text-white border-white/25 shadow-xs'
              : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border-white/10 hover:border-white/20'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
          <span>Edit Profile</span>
        </button>
      </div>
    </div>
  )
}
