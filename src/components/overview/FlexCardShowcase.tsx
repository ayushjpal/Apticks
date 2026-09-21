import React, { useState, useEffect, useRef } from 'react'
import {
  User,
  Trophy,
  LayoutDashboard,
  HelpCircle,
  Swords,
  Timer,
  Award,
  Flame,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'

interface CardDefinition {
  id: string
  title: string
  index: string
  icon: React.ElementType
}

const CARDS: CardDefinition[] = [
  {
    id: 'profile',
    title: 'PROFILE',
    index: '01',
    icon: User,
  },
  {
    id: 'rank',
    title: 'RANK',
    index: '02',
    icon: Trophy,
  },
  {
    id: 'dashboard',
    title: 'DASHBOARD',
    index: '03',
    icon: LayoutDashboard,
  },
  {
    id: 'solver',
    title: 'SOLVER',
    index: '04',
    icon: HelpCircle,
  },
  {
    id: 'arena',
    title: '1V1 ARENA',
    index: '05',
    icon: Swords,
  },
]

export default function FlexCardShowcase() {
  // Card 4 (SOLVER) starts as the default active card
  const [activeCard, setActiveCard] = useState<number>(3)
  const [isPaused, setIsPaused] = useState<boolean>(false)
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 1. Detect prefers-reduced-motion updates
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handler = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches)
    }

    if (mql.addEventListener) {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
  }, [])

  // 2. Slow auto-rotation (~4.5s) when not paused and not reduced motion
  useEffect(() => {
    if (reducedMotion || isPaused) return

    const interval = setInterval(() => {
      setActiveCard((prev) => (prev + 1) % CARDS.length)
    }, 4500)

    return () => clearInterval(interval)
  }, [isPaused, reducedMotion])

  // Cleanup resume timer on unmount
  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current)
      }
    }
  }, [])

  // Handle interaction pause & delayed resume
  const handleInteractionStart = (index?: number) => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
    setIsPaused(true)
    if (typeof index === 'number') {
      setActiveCard(index)
      // When explicitly selected via click or tap, pause and schedule resume after 4s of idle
      resumeTimerRef.current = setTimeout(() => {
        setIsPaused(false)
      }, 4000)
    }
  }

  const handleInteractionEnd = () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current)
    }
    resumeTimerRef.current = setTimeout(() => {
      setIsPaused(false)
    }, 2000)
  }

  return (
    <div
      id="flex-card-showcase"
      className="w-full max-w-2xl mx-auto select-none"
      onMouseEnter={() => handleInteractionStart()}
      onMouseLeave={handleInteractionEnd}
      onFocusCapture={() => handleInteractionStart()}
      onBlurCapture={handleInteractionEnd}
    >
      {/* ========================================================= */}
      {/* DESKTOP / TABLET HORIZONTAL FLEX ACCORDION (md and up)     */}
      {/* ========================================================= */}
      <div
        role="tablist"
        aria-label="Apticks arena feature showcase"
        className="hidden md:flex flex-row gap-2.5 h-[480px] lg:h-[500px] w-full"
      >
        {CARDS.map((card, idx) => {
          const isActive = idx === activeCard
          const Icon = card.icon

          return (
            <div
              key={card.id}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              aria-label={card.title}
              onClick={() => handleInteractionStart(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleInteractionStart(idx)
                }
              }}
              style={{
                transition: reducedMotion
                  ? 'none'
                  : 'flex 500ms cubic-bezier(0.16, 1, 0.3, 1), transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className={`
                relative rounded-xl overflow-hidden cursor-pointer border text-left flex flex-col
                ${
                  isActive
                    ? 'flex-[5] bg-[#0c1d2d] border-slate-700/80 shadow-lg'
                    : 'flex-[1] bg-[#0c1d2d]/60 hover:bg-[#0c1d2d]/90 border-slate-800/80 hover:border-slate-700 transition-colors'
                }
              `}
            >
              {/* Inactive Vertical Strip */}
              {!isActive && (
                <div className="w-full h-full flex flex-col items-center justify-between py-6 px-1">
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    {card.index}
                  </span>

                  <div className="flex flex-col items-center gap-3 my-auto">
                    <Icon className="w-4 h-4 text-slate-400" />
                    <span
                      style={{ writingMode: 'vertical-rl' }}
                      className="rotate-180 font-display font-bold text-xs tracking-wider text-slate-400 uppercase"
                    >
                      {card.title}
                    </span>
                  </div>

                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                </div>
              )}

              {/* Active Expanded Card Content */}
              {isActive && (
                <div
                  className={`w-full h-full p-5 lg:p-6 flex flex-col justify-between overflow-hidden ${
                    reducedMotion ? '' : 'animate-entry'
                  }`}
                >
                  {/* Subtle Top Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[#ffd43b]">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-display font-bold text-xs tracking-wider uppercase text-slate-200">
                        {card.title}
                      </span>
                    </div>

                    <span className="font-mono text-xs font-semibold text-slate-500">
                      {card.index}
                    </span>
                  </div>

                  {/* Active Card Body Content */}
                  <div className="flex-1 flex flex-col justify-center">
                    {card.id === 'profile' && <ProfileCardContent />}
                    {card.id === 'rank' && <RankCardContent />}
                    {card.id === 'dashboard' && <DashboardCardContent />}
                    {card.id === 'solver' && <SolverCardContent />}
                    {card.id === 'arena' && <ArenaCardContent />}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ========================================================= */}
      {/* MOBILE VERTICAL ACCORDION (< md)                           */}
      {/* ========================================================= */}
      <div
        role="tablist"
        aria-label="Apticks arena feature showcase"
        className="flex md:hidden flex-col gap-2 w-full"
      >
        {CARDS.map((card, idx) => {
          const isActive = idx === activeCard
          const Icon = card.icon

          return (
            <div
              key={card.id}
              className={`rounded-xl border overflow-hidden transition-all duration-300 ${
                isActive
                  ? 'bg-[#0c1d2d] border-slate-700 shadow-md'
                  : 'bg-[#0c1d2d]/60 border-slate-800/70 hover:bg-[#0c1d2d]/90'
              }`}
            >
              {/* Header Bar (Clickable) */}
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleInteractionStart(idx)}
                className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {card.index}
                  </span>
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center border ${
                      isActive
                        ? 'bg-amber-400/10 border-amber-400/30 text-[#ffd43b]'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span
                    className={`font-display font-bold text-xs uppercase tracking-wider ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  >
                    {card.title}
                  </span>
                </div>

                <div
                  className={`w-2 h-2 rounded-full transition-colors ${
                    isActive ? 'bg-[#ffd43b]' : 'bg-slate-700'
                  }`}
                />
              </button>

              {/* Expanded Mobile Content */}
              {isActive && (
                <div className="p-4 pt-1 border-t border-slate-800/60">
                  {card.id === 'profile' && <ProfileCardContent />}
                  {card.id === 'rank' && <RankCardContent />}
                  {card.id === 'dashboard' && <DashboardCardContent />}
                  {card.id === 'solver' && <SolverCardContent />}
                  {card.id === 'arena' && <ArenaCardContent />}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// 1. PROFILE CARD CONTENT: Atmospheric abstract visual + profile overlay
// ============================================================================
function ProfileCardContent() {
  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden relative flex flex-col justify-end min-h-[260px]">
      {/* Atmospheric Abstract Environmental Landscape Graphic */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a1826] to-[#071a2b] overflow-hidden">
        <svg
          className="w-full h-full object-cover opacity-35"
          viewBox="0 0 400 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle star points in deep night sky */}
          <circle cx="60" cy="40" r="1.2" fill="#ffd43b" opacity="0.7" />
          <circle cx="140" cy="25" r="1" fill="#ffffff" opacity="0.6" />
          <circle cx="280" cy="45" r="1.5" fill="#ffd43b" opacity="0.8" />
          <circle cx="340" cy="20" r="1" fill="#ffffff" opacity="0.5" />
          <circle cx="210" cy="60" r="0.8" fill="#ffffff" opacity="0.4" />

          {/* Layered geometric mountain ridges */}
          <polygon
            points="0,240 60,130 150,190 220,110 320,180 400,120 400,240"
            fill="#0e2337"
          />
          <polygon
            points="0,240 100,160 180,210 270,140 370,220 400,180 400,240"
            fill="#0a1d2e"
          />
          <polygon
            points="0,240 40,200 120,225 210,185 300,220 400,190 400,240"
            fill="#071a2b"
          />

          {/* Ridge contour line */}
          <polyline
            points="0,240 60,130 150,190 220,110 320,180 400,120"
            stroke="rgba(255,212,59,0.2)"
            strokeWidth="1"
          />
        </svg>

        {/* Gradient Scrim for effortless readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#071a2b] via-[#071a2b]/80 to-transparent" />
      </div>

      {/* Fictional Profile Overlay */}
      <div className="relative z-10 p-5 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#0c1d2d] border border-amber-400/40 flex items-center justify-center font-display font-black text-base text-[#ffd43b] shadow-sm shrink-0">
            QC
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base text-white truncate">
                quantum_coder
              </span>
              <span className="px-1.5 py-0.5 bg-amber-400/10 border border-amber-400/30 text-[#ffd43b] font-mono text-[10px] font-bold rounded">
                Level 03
              </span>
            </div>
            <div className="font-mono text-xs text-slate-400">
              1,250 XP • Titanium Division
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 font-mono text-xs">
          <div className="bg-[#0c1d2d]/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-slate-400">Accuracy</span>
            <span className="text-emerald-400 font-bold">88.4%</span>
          </div>

          <div className="bg-[#0c1d2d]/90 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <span className="text-slate-400">Streak</span>
            <span className="text-amber-400 font-bold">12 Days</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 2. RANK CARD CONTENT: Compact polished leaderboard preview
// ============================================================================
function RankCardContent() {
  return (
    <div className="bg-[#071a2b] border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            GLOBAL RANK
          </div>
          <div className="font-display font-extrabold text-2xl text-white tracking-tight flex items-center gap-2">
            <span>#128</span>
            <span className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> +4
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            TOTAL SCORE
          </div>
          <div className="font-mono font-bold text-sm text-[#ffd43b]">
            1,250 XP
          </div>
        </div>
      </div>

      <div className="space-y-1.5 font-mono text-xs">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/20 text-slate-400">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-500 w-7">#126</span>
            <span>cipher_99</span>
          </div>
          <span>1,290 XP</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/20 text-slate-400">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-500 w-7">#127</span>
            <span>vortex_dev</span>
          </div>
          <span>1,270 XP</span>
        </div>

        {/* Highlighted Row */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-white font-bold">
          <div className="flex items-center gap-2.5">
            <span className="text-[#ffd43b] w-7">#128</span>
            <span>quantum_coder</span>
          </div>
          <span className="text-[#ffd43b]">1,250 XP</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/20 text-slate-400">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-500 w-7">#129</span>
            <span>sigma_solve</span>
          </div>
          <span>1,230 XP</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 3. DASHBOARD CARD CONTENT: 12 Day Streak, Level 03, 83% progress, Today's Challenge (+50 XP)
// ============================================================================
function DashboardCardContent() {
  return (
    <div className="bg-[#071a2b] border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col gap-3">
      {/* 12 Day Streak */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-[#ffd43b]">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="font-display font-bold text-sm text-white">
              12 Day Streak
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              Consecutive active days
            </div>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded bg-amber-400/10 text-[#ffd43b] border border-amber-400/20 font-mono text-xs font-bold">
          ACTIVE
        </span>
      </div>

      {/* Level 03 & 83% Progress */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between font-mono text-xs mb-2">
          <span className="text-white font-bold">Level 03</span>
          <span className="text-[#ffd43b] font-bold">83% Progress</span>
        </div>
        <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
          <div className="h-full bg-[#ffd43b] rounded-full w-[83%]" />
        </div>
      </div>

      {/* Today's Challenge */}
      <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-xs text-white">
            Today&apos;s Challenge
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Speed Aptitude Arena
          </div>
        </div>

        <span className="font-mono text-xs font-bold text-[#ffd43b] bg-[#0c1d2d] px-2.5 py-1 rounded border border-amber-400/30">
          +50 XP
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// 4. SOLVER CARD CONTENT: Realistic aptitude problem preview
// ============================================================================
function SolverCardContent() {
  return (
    <div className="bg-white text-slate-900 border border-slate-200/90 rounded-xl p-4 sm:p-5 flex flex-col gap-3 shadow-sm">
      {/* Category, Topic, Difficulty & HUD */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold uppercase">
            Quantitative Aptitude
          </span>
          <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
            Time & Work
          </span>
          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
            Medium
          </span>
        </div>

        <div className="flex items-center gap-2.5 font-mono text-xs">
          <div className="flex items-center gap-1 text-slate-600">
            <Timer className="w-3.5 h-3.5 text-slate-400" />
            <span>00:28</span>
          </div>
          <div className="flex items-center gap-1 font-bold text-amber-600">
            <Award className="w-3.5 h-3.5" />
            <span>15 XP</span>
          </div>
        </div>
      </div>

      {/* Question Prompt */}
      <div className="font-sans text-xs sm:text-sm text-slate-800 leading-snug">
        If 5 workers can complete a task in 12 days, how many days will 8 workers take?
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
        <div className="p-2 rounded-lg border border-amber-400 bg-amber-50/90 text-slate-900 font-bold flex items-center justify-between">
          <span>A. 7.5 days</span>
          <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        </div>
        <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-600">
          B. 6.8 days
        </div>
        <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-600">
          C. 8 days
        </div>
        <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-600">
          D. 9.2 days
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 5. 1V1 ARENA CARD CONTENT: Matchup preview, scores 24 - 18, Round 3/5
// ============================================================================
function ArenaCardContent() {
  return (
    <div className="bg-[#071a2b] border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col gap-3.5">
      <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-slate-800">
        <span className="text-white font-bold uppercase tracking-wider">
          1V1 ARENA
        </span>
        <span className="text-slate-400">ROUND 3 / 5</span>
      </div>

      {/* Matchup Competitors */}
      <div className="grid grid-cols-3 items-center text-center">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center font-display font-bold text-sm text-[#ffd43b] mb-1">
            QC
          </div>
          <div className="font-display font-bold text-xs text-white">quantum_coder</div>
          <div className="font-mono text-[10px] text-slate-400">LVL 03</div>
          <div className="font-mono font-extrabold text-xl text-[#ffd43b] mt-1">24</div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="font-display font-extrabold text-sm text-slate-400">
            VS
          </div>
          <div className="font-mono text-[10px] text-slate-500 mt-1">
            ROUND 3
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-display font-bold text-sm text-slate-300 mb-1">
            N9
          </div>
          <div className="font-display font-bold text-xs text-slate-300">nexus_9</div>
          <div className="font-mono text-[10px] text-slate-400">LVL 04</div>
          <div className="font-mono font-extrabold text-xl text-slate-300 mt-1">18</div>
        </div>
      </div>

      {/* Clean Match Progress Bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
        <div className="h-full bg-[#ffd43b]" style={{ width: '57%' }} />
        <div className="h-full bg-slate-600" style={{ width: '43%' }} />
      </div>
    </div>
  )
}
