import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Flame,
  Zap,
  Shield,
  Menu,
  X,
  Home,
  Trophy,
  BookOpen,
  BarChart2,
  Users,
  Swords,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ProfileService, type UserProfile } from '../../services/profileService'
import { QuestionService } from '../../services/questionService'
import { StreakService } from '../../services/streakService'
import { LeaderboardService } from '../../services/leaderboardService'
import { calculateLevelProgress } from '../../utils/levelEngine'
import type { UserStreak } from '../../types/questions'

interface NavItem {
  id: string
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'HOME', path: '/dashboard', icon: Home },
  { id: 'practice', label: 'PRACTICE', path: '/questions', icon: BookOpen },
  { id: 'contests', label: 'CONTESTS', path: '/contests', icon: Trophy },
  { id: '1v1', label: '1V1', path: '/1v1', icon: Swords },
  { id: 'rank', label: 'RANK', path: '/leaderboard', icon: BarChart2 },
  { id: 'social', label: 'SOCIAL', path: '/social', icon: Users },
]

export default function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [totalXP, setTotalXP] = useState(0)
  const [userLevel, setUserLevel] = useState<number | null>(null)
  const [levelTitle, setLevelTitle] = useState<string | null>(null)
  const [streakData, setStreakData] = useState<UserStreak | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)


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

        // Fetch Live Streak & Authoritative Unified XP concurrently
        try {
          const [userStreak, rankRes] = await Promise.all([
            StreakService.getUserStreak(user.id),
            LeaderboardService.getUserGlobalRank(user.id),
          ])

          if (isMounted) {
            setStreakData(userStreak)
            if (rankRes.found && typeof rankRes.totalXp === 'number') {
              setTotalXP(rankRes.totalXp)
              setUserLevel(rankRes.level ?? 1)
              setLevelTitle(rankRes.levelTitle ?? 'Novice')
            } else {
              // Fallback calculation if rank RPC not found
              const { questions, progressMap, challengeBonusXp, contestXp } =
                await QuestionService.getQuestionsWithProgress(user.id)
              if (isMounted) {
                const stats = QuestionService.calculateStats(questions, progressMap, [], challengeBonusXp, contestXp)
                setTotalXP(stats.totalPoints)
                const prog = calculateLevelProgress(stats.totalPoints)
                setUserLevel(prog.level)
                setLevelTitle(prog.title)
              }
            }
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

  const getIsActive = (path: string) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return true
    if (path === '/contests' && location.pathname.startsWith('/contests')) return true
    if (path === '/questions' && location.pathname.startsWith('/questions')) return true
    if (path === '/leaderboard' && location.pathname.startsWith('/leaderboard')) return true
    if (path === '/social' && location.pathname.startsWith('/social')) return true
    if (path === '/1v1' && location.pathname.startsWith('/1v1')) return true
    if (path === '/profile' && location.pathname.startsWith('/profile')) return true
    return false
  }

  return (
    <header className="sticky top-0 z-40 bg-[#071a2b]/95 backdrop-blur-md border-b-2 border-[#1a3047]">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 lg:px-8 flex items-center justify-between gap-3 lg:gap-6">
        {/* Left Section: Brand Logo + Primary Desktop Navigation */}
        <div className="flex items-center gap-4 lg:gap-8 shrink-0">
          {/* Brand Logo */}
          <Link
            to="/dashboard"
            className="flex items-center gap-2 sm:gap-2.5 group shrink-0"
            aria-label="Apticks Dashboard"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-[#ffd43b] border-2 border-[#0c1d2d] shadow-[2px_2px_0_#0c1d2d] rounded-xl flex items-center justify-center transition-transform group-hover:-translate-y-0.5">
              <span className="font-display font-black text-sm text-[#0c1d2d]">A</span>
            </div>
            <div>
              <div className="font-display font-black text-base sm:text-lg tracking-tight text-white leading-none">
                APTICKS
              </div>
              <div className="font-mono text-[8px] sm:text-[9px] font-bold tracking-[0.15em] text-white/50 uppercase mt-0.5">
                SPEED ARENA
              </div>
            </div>
          </Link>

          {/* Primary Navigation Links (Desktop) */}
          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1 lg:gap-1.5">
            {NAV_ITEMS.map((item) => {
              const isActive = getIsActive(item.path)

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  className={`
                    px-2.5 lg:px-3 py-1.5 rounded-lg font-display font-black text-xs uppercase tracking-wider
                    transition-all duration-150 select-none
                    ${
                      isActive
                        ? 'bg-[#ffd43b] text-[#0c1d2d] shadow-[1.5px_1.5px_0_#0c1d2d]'
                        : 'text-white/70 hover:text-white hover:bg-white/[0.08]'
                    }
                  `}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right Section: HUD Metrics, Staff & Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Streak Indicator */}
          {(streakData?.currentStreak ?? 0) > 0 ? (
            <div
              className={`hidden min-[400px]:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition-all ${
                streakData?.isActiveToday
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-white/70'
              }`}
              title={`${streakData?.currentStreak}-Day Active Solving Streak`}
            >
              <Flame className={`w-3.5 h-3.5 shrink-0 ${streakData?.isActiveToday ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
              <span>{streakData?.currentStreak}D</span>
            </div>
          ) : (
            <div
              className="hidden min-[400px]:flex items-center gap-1.5 bg-white/5 text-white/40 border border-white/10 rounded-lg px-2 py-1 text-[11px] font-mono font-medium"
              title="0-Day Streak • Solve a question today to ignite your streak"
            >
              <Flame className="w-3 h-3 text-white/30 shrink-0" />
              <span>0D</span>
            </div>
          )}

          {/* Unified Competitive Status HUD (LVL 02  •  XP 204) */}
          <div className="flex items-center bg-[#0c1d2d] border border-white/15 rounded-lg overflow-hidden shadow-xs divide-x divide-white/10 font-mono">
            {userLevel !== null && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-white/90 hover:bg-white/5 transition-colors cursor-default"
                title={`Rank Tier: ${levelTitle || 'Novice'} • Level ${userLevel}`}
              >
                <span className="text-[10px] font-display font-bold text-white/40 tracking-wider uppercase">LVL</span>
                <span className="font-bold text-[#ffd43b]">{String(userLevel).padStart(2, '0')}</span>
              </div>
            )}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-white font-bold hover:bg-white/5 transition-colors cursor-default"
              title="Authoritative Unified XP"
            >
              <Zap className="w-3 h-3 text-[#ffd43b] fill-[#ffd43b] shrink-0" />
              <span>{totalXP}</span>
              <span className="text-[10px] font-display font-bold text-white/40 tracking-wider uppercase">XP</span>
            </div>
          </div>

          {/* Staff Control Center Button (Staff Only) */}
          {(profile?.role === 'admin' || profile?.role === 'moderator') && (
            <Link
              to="/moderator"
              className="flex items-center gap-1.5 bg-white/5 text-[#ffd43b] hover:bg-[#ffd43b] hover:text-[#0c1d2d] border border-[#ffd43b]/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition-all shrink-0"
              title="Enter Staff Control Center"
            >
              <Shield className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="hidden lg:inline">STAFF</span>
            </Link>
          )}

          {/* Avatar Profile Trigger */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Open Profile"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#38aef0] border-[1.5px] border-[#0c1d2d] shadow-[1.5px_1.5px_0_#0c1d2d] flex items-center justify-center overflow-hidden transition-transform hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer shrink-0"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username || 'Avatar'}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-display font-black text-sm text-[#0c1d2d]">
                {initial}
              </span>
            )}
          </button>

          {/* Mobile Navigation Toggle (< md) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden w-8 h-8 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-white/10"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown Menu */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile Navigation"
          className="md:hidden border-t border-[#1a3047] px-4 py-3 space-y-1 bg-[#071a2b]/98"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = getIsActive(item.path)
            const Icon = item.icon

            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider
                  transition-colors select-none
                  ${
                    isActive
                      ? 'bg-[#ffd43b] text-[#0c1d2d] shadow-[1.5px_1.5px_0_#0c1d2d]'
                      : 'text-white/75 hover:text-white hover:bg-white/[0.08]'
                  }
                `}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}

          {(profile?.role === 'admin' || profile?.role === 'moderator') && (
            <Link
              to="/moderator"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-display font-black text-xs uppercase tracking-wider text-[#ffd43b] hover:bg-white/[0.08] transition-colors border-t border-[#1a3047] mt-1.5 pt-2.5"
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>STAFF CONTROL CENTER</span>
            </Link>
          )}
        </nav>
      )}
    </header>
  )
}
