import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Flame, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ProfileService, type UserProfile } from '../../services/profileService'
import { QuestionService } from '../../services/questionService'
import { StreakService } from '../../services/streakService'
import type { UserStreak } from '../../types/questions'

export default function AppHeader() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [totalXP, setTotalXP] = useState(0)
  const [streakData, setStreakData] = useState<UserStreak | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadHeaderUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user || !isMounted) return

        let p = await ProfileService.fetchProfile(user.id)
        if (!p?.username && user.user_metadata?.username) {
          p = {
            id: user.id,
            username: user.user_metadata.username,
            display_name: user.user_metadata.display_name || user.user_metadata.username,
            avatar_url: p?.avatar_url || null,
            bio: p?.bio || null,
            username_changed_at: p?.username_changed_at || null,
          }
        }

        if (isMounted) {
          setProfile(p)
        }

        // Fetch Live Streak & XP concurrently
        try {
          const [userStreak, { questions, progressMap, challengeBonusXp }] = await Promise.all([
            StreakService.getUserStreak(user.id),
            QuestionService.getQuestionsWithProgress(user.id),
          ])

          if (isMounted) {
            setStreakData(userStreak)
            const stats = QuestionService.calculateStats(questions, progressMap, [], challengeBonusXp)
            setTotalXP(stats.totalPoints)
          }
        } catch (e) {
          console.warn('Header stats/streak fetch note:', e)
        }
      } catch (err) {
        console.warn('Header load note:', err)
      }
    }

    loadHeaderUser()

    return () => {
      isMounted = false
    }
  }, [])

  const initial =
    profile?.display_name?.charAt(0).toUpperCase() ||
    profile?.username?.charAt(0).toUpperCase() ||
    'P'

  return (
    <header className="sticky top-0 z-40 bg-[#071a2b]/95 backdrop-blur-md border-b-3 border-black px-4 py-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo */}
        <Link to="/dashboard" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#ffd43b] border-2 sm:border-3 border-black shadow-[2.5px_2.5px_0_#000000] rounded-xl flex items-center justify-center font-display font-black text-xl sm:text-2xl text-black transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
            A
          </div>
          <div>
            <div className="font-display font-black text-lg sm:text-xl tracking-tight text-white leading-none">
              APTICKS
            </div>
            <div className="font-mono text-[8px] sm:text-[9px] font-bold tracking-[0.2em] text-[#38aef0] uppercase mt-0.5">
              SPEED ARENA
            </div>
          </div>
        </Link>

        {/* Quick HUD Metrics & Profile Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Streak pill (hidden on very narrow screens, visible on >= 400px) */}
          {(streakData?.currentStreak ?? 0) > 0 ? (
            <div className={`hidden min-[400px]:flex items-center gap-1.5 ${streakData?.isActiveToday ? 'bg-[#ff5b5b]' : 'bg-[#ff7b7b]'} text-white border-2 border-black shadow-[2px_2px_0_#000000] rounded-full px-2.5 py-1 text-[11px] font-display font-black`}>
              <Flame className={`w-3.5 h-3.5 fill-white shrink-0 ${streakData?.isActiveToday ? 'animate-pulse' : ''}`} />
              <span>{streakData?.currentStreak}D STREAK</span>
            </div>
          ) : (
            <div className="hidden min-[400px]:flex items-center gap-1.5 bg-white/10 text-white/70 border-2 border-black shadow-[2px_2px_0_#000000] rounded-full px-2.5 py-1 text-[11px] font-display font-black">
              <Flame className="w-3.5 h-3.5 text-white/50 shrink-0" />
              <span>0D STREAK</span>
            </div>
          )}

          {/* XP pill */}
          <div className="flex items-center gap-1.5 bg-[#ffd43b] text-black border-2 border-black shadow-[2px_2px_0_#000000] rounded-full px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-display font-black">
            <Zap className="w-3.5 h-3.5 fill-black shrink-0" />
            <span>{totalXP} XP</span>
          </div>

          {/* Avatar Profile Trigger */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Open Athlete Profile"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#38aef0] border-2 sm:border-3 border-black shadow-[2px_2px_0_#000000] flex items-center justify-center overflow-hidden transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 cursor-pointer shrink-0"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username || 'Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-display font-black text-sm text-black">
                {initial}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
