import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Trophy,
  Zap,
  CheckCircle2,
  XCircle,
  BookOpen,
  ArrowRight,
  Flame,
  Clock,
  ChevronRight,
  Calculator,
  Brain,
  BarChart3,
  Swords,
  Target,
} from 'lucide-react'
import { QuestionService } from '../services/questionService'
import { ChallengeService } from '../services/challengeService'
import { ContestService } from '../services/contestService'
import type {
  DailyChallenge,
  Question,
  UserQuestionProgress,
  QuestionBankStats,
  UserQuestionAttempt,
} from '../types/questions'
import type { Contest } from '../types/contests'
import { useUserSession } from '../contexts/UserSessionContext'
import { StatusBadge } from '../components/ui'

interface ArenaCategory {
  id: string
  name: string
  icon: typeof Calculator
  matchFn: (cat: string) => boolean
  description: string
}

const ARENA_CATEGORIES: ArenaCategory[] = [
  {
    id: 'quant',
    name: 'Quantitative Aptitude',
    icon: Calculator,
    matchFn: (cat) => cat.toLowerCase().includes('quant'),
    description: 'Arithmetic, Algebra, Geometry & Number Systems',
  },
  {
    id: 'logical',
    name: 'Logical Reasoning',
    icon: Brain,
    matchFn: (cat) => cat.toLowerCase().includes('logic'),
    description: 'Deduction, Series, Syllogisms & Arrangements',
  },
  {
    id: 'verbal',
    name: 'Verbal & Abstract',
    icon: BookOpen,
    matchFn: (cat) => cat.toLowerCase().includes('verbal'),
    description: 'Comprehension, Grammar & Critical Logic',
  },
  {
    id: 'data',
    name: 'Data Interpretation',
    icon: BarChart3,
    matchFn: (cat) => cat.toLowerCase().includes('data'),
    description: 'Tables, Graphs, Charts & Analytical Sets',
  },
]

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const formatRelativeTime = (isoString: string): string => {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000))
    if (diffSeconds < 60) return 'Just now'
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return 'Recently'
  }
}

const formatTimeLeft = (seconds: number) => {
  if (seconds <= 0) return 'Ending soon'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h <= 0) return `${m}m left`
  return `${h}h ${m}m left`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    user,
    profile,
    streak: streakData,
    rank: userRank,
    levelProgress,
    loading: sessionLoading,
  } = useUserSession()

  const [dailyChallenge, setDailyChallenge] = useState<DailyChallenge | null>(null)
  const [contests, setContests] = useState<Contest[]>([])
  const [rawQuestions, setRawQuestions] = useState<Question[]>([])
  const [rawProgressMap, setRawProgressMap] = useState<Record<string, UserQuestionProgress>>({})
  const [questionStats, setQuestionStats] = useState<QuestionBankStats | null>(null)
  const [userAttempts, setUserAttempts] = useState<UserQuestionAttempt[]>([])
  const [dataLoading, setDataLoading] = useState<boolean>(true)

  useEffect(() => {
    let isMounted = true

    const loadDashboardData = async () => {
      if (sessionLoading) return
      if (!user) {
        navigate('/login', { replace: true })
        return
      }

      try {
        const [
          challenge,
          { questions, progressMap, challengeBonusXp, contestXp },
          contestList,
          attemptsList,
        ] = await Promise.all([
          ChallengeService.getDailyChallenge(),
          QuestionService.getQuestionsWithProgress(user.id),
          ContestService.getContests(),
          QuestionService.getUserAttempts(user.id, 5),
        ])

        if (isMounted) {
          setDailyChallenge(challenge)
          setContests(contestList)
          setRawQuestions(questions)
          setRawProgressMap(progressMap)
          setUserAttempts(attemptsList)

          const stats = QuestionService.calculateStats(
            questions,
            progressMap,
            [],
            challengeBonusXp,
            contestXp
          )
          setQuestionStats(stats)
          setDataLoading(false)
        }
      } catch (error) {
        console.error('Dashboard loading error:', error)
        if (isMounted) {
          setDataLoading(false)
        }
      }
    }

    loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [user, sessionLoading, navigate])

  const questionsById = useMemo(() => {
    const map = new Map<string, Question>()
    rawQuestions.forEach((q) => map.set(q.id, q))
    return map
  }, [rawQuestions])

  const categoryProgress = useMemo(() => {
    const result: Record<string, { total: number; solved: number }> = {
      quant: { total: 0, solved: 0 },
      logical: { total: 0, solved: 0 },
      verbal: { total: 0, solved: 0 },
      data: { total: 0, solved: 0 },
    }

    if (!rawQuestions.length) {
      return {
        quant: { total: 240, solved: 0 },
        logical: { total: 210, solved: 0 },
        verbal: { total: 175, solved: 0 },
        data: { total: 75, solved: 0 },
      }
    }

    rawQuestions.forEach((q) => {
      const isSolved = Boolean(rawProgressMap[q.id]?.isSolved)
      for (const cat of ARENA_CATEGORIES) {
        if (cat.matchFn(q.category)) {
          result[cat.id].total += 1
          if (isSolved) result[cat.id].solved += 1
          break
        }
      }
    })

    return result
  }, [rawQuestions, rawProgressMap])

  const rawName = profile?.display_name || profile?.username || 'Competitor'
  const firstName = rawName.trim().split(' ')[0]
  const greeting = getGreeting()

  const solvedCount = questionStats?.solvedCount ?? 0
  const totalQuestions = questionStats?.totalQuestions ?? (rawQuestions.length || 700)
  const accuracyRate = questionStats?.accuracyRate ?? 0

  const easySolved = questionStats?.easySolved ?? 0
  const easyTotal = Math.max(questionStats?.easyTotal ?? 227, 1)
  const mediumSolved = questionStats?.mediumSolved ?? 0
  const mediumTotal = Math.max(questionStats?.mediumTotal ?? 340, 1)
  const hardSolved = questionStats?.hardSolved ?? 0
  const hardTotal = Math.max(questionStats?.hardTotal ?? 133, 1)

  const totalXp = levelProgress?.totalXp ?? questionStats?.totalPoints ?? 0
  const currentLevel = levelProgress?.level ?? 1
  const levelTitle = levelProgress?.title ?? 'Novice'
  const currentLevelXp = levelProgress?.currentLevelXp ?? 0
  const nextLevelXp = levelProgress?.nextLevelXp ?? 100
  const levelRangeXp = Math.max(nextLevelXp - currentLevelXp, 1)
  const xpInLevel = levelProgress?.xpInLevel ?? 0
  const progressPercentage = levelProgress?.progressPercentage ?? 0

  return (
    <div className="max-w-[1240px] mx-auto space-y-4 sm:space-y-5 pb-6">
      {/* ========================================================= */}
      {/* SECTION 1: EDITORIAL HERO & COMPETITIVE STATUS RIBBON      */}
      {/* ========================================================= */}
      <section className="space-y-3">
        {/* Editorial Greeting Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
          <div>
            <div className="text-slate-400 font-display font-medium text-xs sm:text-sm">
              {greeting}, <span className="text-slate-200 font-semibold">{firstName}</span>.
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight leading-none mt-1">
              READY FOR TODAY?
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/questions"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg text-xs font-semibold text-white transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-slate-300" />
              <span>Practice All</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>

            <Link
              to="/contests"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#ffd43b]/15 hover:bg-[#ffd43b]/25 border border-[#ffd43b]/30 rounded-lg text-xs font-semibold text-[#ffd43b] transition-colors"
            >
              <Trophy className="w-3.5 h-3.5 text-[#ffd43b]" />
              <span>Tournaments</span>
            </Link>
          </div>
        </div>

        {/* High-Density Competitive Status Ribbon */}
        <div className="bg-[#0a1c2c] border border-[#173047] rounded-xl p-3 sm:p-4 text-slate-200 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 divide-y sm:divide-y-0 md:divide-x divide-white/10">
            {/* Metric 1: Global Rank */}
            <div className="pt-2 sm:pt-0 sm:pr-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                <span className="flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  GLOBAL RANK
                </span>
              </div>
              <div className="my-1.5">
                <div className="font-display font-black text-2xl sm:text-3xl text-white leading-none">
                  {userRank ? `#${userRank}` : '—'}
                </div>
              </div>
              <Link
                to="/leaderboard"
                className="text-[11px] font-mono text-sky-400 hover:underline flex items-center gap-1"
              >
                <span>Arena Standings</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            </div>

            {/* Metric 2: Current Level & Progress */}
            <div className="pt-2 sm:pt-0 sm:px-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                <span>CURRENT LEVEL</span>
                <span className="bg-[#ffd43b] text-[#071a2b] px-1.5 py-0.2 rounded font-black text-[10px]">
                  LVL {String(currentLevel).padStart(2, '0')}
                </span>
              </div>
              <div className="my-1.5">
                <div className="font-display font-bold text-sm sm:text-base text-white truncate">
                  {levelTitle}
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="h-full bg-[#ffd43b] rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                <span>{xpInLevel} / {levelRangeXp} XP</span>
                <span>{progressPercentage}%</span>
              </div>
            </div>

            {/* Metric 3: Total XP */}
            <div className="pt-2 sm:pt-0 sm:px-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#ffd43b] fill-[#ffd43b]" />
                  TOTAL SCORE
                </span>
              </div>
              <div className="my-1.5">
                <div className="font-display font-black text-2xl sm:text-3xl text-white leading-none">
                  {totalXp.toLocaleString()}
                  <span className="text-xs font-mono font-bold text-[#ffd43b] ml-1">XP</span>
                </div>
              </div>
              <div className="text-[10px] font-mono text-slate-400 truncate">
                {levelProgress?.xpRequired ?? 0} XP to Next Level
              </div>
            </div>

            {/* Metric 4: Active Streak */}
            <div className="pt-2 sm:pt-0 sm:pl-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                <span className="flex items-center gap-1">
                  <Flame
                    className={`w-3.5 h-3.5 ${
                      streakData?.isActiveToday ? 'text-amber-400 fill-amber-400' : 'text-slate-500'
                    }`}
                  />
                  ACTIVE STREAK
                </span>
              </div>
              <div className="my-1.5 flex items-baseline gap-1.5">
                <span className="font-display font-black text-2xl sm:text-3xl text-white leading-none">
                  {streakData?.currentStreak ?? 0}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">DAYS</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400">Best: {streakData?.longestStreak ?? 0}d</span>
                {streakData?.isActiveToday ? (
                  <span className="text-emerald-400 font-semibold">Active Today</span>
                ) : (
                  <span className="text-amber-400 font-medium">Needs Solve</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 2: MAIN 2-COLUMN ARENA LAYOUT                     */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 sm:gap-5 items-start">
        {/* ======================================================= */}
        {/* LEFT COLUMN: PRIMARY ACTION & ARENA DOMAINS             */}
        {/* ======================================================= */}
        <div className="space-y-4 sm:space-y-5">
          {/* PRIMARY ACTION: TODAY'S CHALLENGE */}
          <section className="bg-[#0c2338] border border-[#ffd43b]/40 rounded-xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#ffd43b]/15 border border-[#ffd43b]/30 flex items-center justify-center">
                  <Flame className="w-3.5 h-3.5 text-[#ffd43b]" />
                </div>
                <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  Today's Challenge
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-[#ffd43b]/15 text-[#ffd43b] border border-[#ffd43b]/30 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold">
                  +{dailyChallenge?.bonusXp ?? 50} XP BONUS
                </span>
                <div className="hidden sm:flex items-center gap-1 font-mono text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{dailyChallenge ? formatTimeLeft(dailyChallenge.secondsLeft) : 'Standby'}</span>
                </div>
              </div>
            </div>

            {/* Challenge Details */}
            <div className="mt-3.5 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {dailyChallenge ? (
                    <StatusBadge
                      status={dailyChallenge.question.difficulty}
                      size="xs"
                      label={dailyChallenge.question.difficulty.toUpperCase()}
                    />
                  ) : (
                    <span className="bg-white/10 text-slate-400 rounded px-1.5 py-0.5 text-[10px] font-mono">
                      STANDARD
                    </span>
                  )}
                  <span className="text-xs font-mono font-semibold text-sky-400 tracking-wide uppercase">
                    {dailyChallenge
                      ? `${dailyChallenge.question.category} // ${dailyChallenge.question.topic}`
                      : 'Aptitude Speed Challenge'}
                  </span>
                </div>

                <div className="sm:hidden flex items-center gap-1 font-mono text-[11px] text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>{dailyChallenge ? formatTimeLeft(dailyChallenge.secondsLeft) : 'Standby'}</span>
                </div>
              </div>

              <h3 className="font-display font-bold text-base sm:text-lg text-white leading-snug">
                {dailyChallenge?.question.title || "Daily Speed Aptitude Problem"}
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-2">
                {dailyChallenge?.question.prompt ||
                  "Daily challenge question is loading or currently syncing. Verify your network connection to solve today's challenge."}
              </p>

              {/* Action Button */}
              <div className="pt-2">
                {dailyChallenge?.isCompleted ? (
                  <div className="w-full py-2.5 px-4 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg font-semibold text-xs flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>✓ COMPLETED (+{dailyChallenge.bonusXpAwarded || dailyChallenge.bonusXp} XP)</span>
                  </div>
                ) : dailyChallenge ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(
                        `/questions/${dailyChallenge.question.id}?challenge=true&challengeId=${dailyChallenge.challengeId}`
                      )
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#ffd43b] hover:bg-[#facb15] text-[#071a2b] font-display font-black text-xs uppercase tracking-wider rounded-lg shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>START CHALLENGE</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full sm:w-auto px-5 py-2.5 bg-white/5 text-slate-500 border border-white/10 rounded-lg text-xs font-semibold cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>Challenge Syncing...</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* PRACTICE ENTRY: CHOOSE YOUR ARENA */}
          <section className="bg-[#0a1c2c] border border-[#173047] rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
              <div>
                <div className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                  PRACTICE
                </div>
                <h2 className="font-display font-bold text-sm text-white leading-tight">
                  Choose your arena
                </h2>
              </div>

              <Link
                to="/questions"
                className="text-xs font-mono text-sky-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <span>All 700 questions</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* 4 Compact Arena Domains */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ARENA_CATEGORIES.map((cat) => {
                const IconComponent = cat.icon
                const stats = categoryProgress[cat.id] || { total: 0, solved: 0 }
                const pct = stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0

                return (
                  <div
                    key={cat.id}
                    onClick={() => navigate('/questions')}
                    className="p-3 bg-[#0e2438] hover:bg-[#122e47] border border-[#1d3b56] hover:border-[#ffd43b]/40 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 group-hover:text-[#ffd43b] group-hover:border-[#ffd43b]/30 flex items-center justify-center transition-colors">
                            <IconComponent className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-display font-bold text-xs sm:text-sm text-white group-hover:text-[#ffd43b] transition-colors leading-tight">
                            {cat.name}
                          </span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>

                      <p className="text-[11px] text-slate-400 mt-1.5 leading-snug line-clamp-1">
                        {cat.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-slate-300 font-medium">
                          {stats.solved} / {stats.total} solved
                        </span>
                        <span className="text-slate-400">{pct}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-sky-400 group-hover:bg-[#ffd43b] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Quick Practice Bottom Strip */}
            <div className="pt-2 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>{Math.max(totalQuestions - solvedCount, 0)} problems remaining</span>
              <button
                type="button"
                onClick={() => navigate('/questions')}
                className="text-sky-400 hover:underline font-semibold cursor-pointer"
              >
                Open Question Bank →
              </button>
            </div>
          </section>
        </div>

        {/* ======================================================= */}
        {/* RIGHT COLUMN: PERFORMANCE, RECENT ACTIVITY, HUB        */}
        {/* ======================================================= */}
        <div className="space-y-4 sm:space-y-5">
          {/* SECTION 4: PERFORMANCE */}
          <section className="bg-[#0a1c2c] border border-[#173047] rounded-xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-sky-400" />
                <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  Performance & Accuracy
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Authoritative</span>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#0e2438] border border-[#1d3b56] rounded-lg">
                <div className="font-display font-black text-2xl sm:text-3xl text-white leading-none">
                  {accuracyRate}%
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-1">
                  Solver Accuracy
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-sky-400 rounded-full"
                    style={{ width: `${accuracyRate}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-[#0e2438] border border-[#1d3b56] rounded-lg">
                <div className="font-display font-black text-2xl sm:text-3xl text-white leading-none">
                  {solvedCount}
                  <span className="text-xs font-normal text-slate-400 font-mono ml-1">
                    / {totalQuestions}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-1">
                  Problems Solved
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-[#ffd43b] rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((solvedCount / Math.max(totalQuestions, 1)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Difficulty Breakdown */}
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Difficulty Progress
              </div>

              {/* Easy */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-400 font-semibold">Easy</span>
                  <span className="text-slate-300">
                    {easySolved} / {easyTotal} ({Math.round((easySolved / easyTotal) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${Math.round((easySolved / easyTotal) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Medium */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-amber-400 font-semibold">Medium</span>
                  <span className="text-slate-300">
                    {mediumSolved} / {mediumTotal} ({Math.round((mediumSolved / mediumTotal) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-[#ffd43b] rounded-full"
                    style={{ width: `${Math.round((mediumSolved / mediumTotal) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Hard */}
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-rose-400 font-semibold">Hard</span>
                  <span className="text-slate-300">
                    {hardSolved} / {hardTotal} ({Math.round((hardSolved / hardTotal) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full bg-rose-400 rounded-full"
                    style={{ width: `${Math.round((hardSolved / hardTotal) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: RECENT ACTIVITY */}
          <section className="bg-[#0a1c2c] border border-[#173047] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  Recent Activity
                </h2>
              </div>
              <Link
                to="/profile"
                className="text-xs font-mono text-sky-400 hover:underline font-semibold"
              >
                Profile Feed →
              </Link>
            </div>

            {dataLoading ? (
              <div className="py-6 text-center font-mono text-xs text-slate-400">
                Loading activity...
              </div>
            ) : userAttempts.length === 0 ? (
              <div className="py-5 px-4 bg-[#0e2438] border border-[#1d3b56] rounded-lg text-center">
                <div className="font-display font-semibold text-xs text-slate-300">
                  No recent attempts recorded
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Solve today's challenge or pick an arena domain above to log your competitive activity.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {userAttempts.slice(0, 4).map((att) => {
                  const q = questionsById.get(att.questionId)
                  const title = att.questionTitle || q?.title || 'Aptitude Problem'
                  const category = att.questionCategory || q?.category || 'General'

                  return (
                    <div
                      key={att.id}
                      className="p-2.5 bg-[#0e2438] border border-[#1d3b56] rounded-lg flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {att.isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="font-display font-medium text-xs text-white truncate">
                            {title}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate">
                            {category} • {formatRelativeTime(att.createdAt)}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 font-mono text-xs font-bold text-right">
                        {att.xpChange > 0 ? (
                          <span className="text-emerald-400">+{att.xpChange} XP</span>
                        ) : att.xpChange < 0 ? (
                          <span className="text-rose-400">{att.xpChange} XP</span>
                        ) : (
                          <span className="text-slate-400">+0 XP</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* SECTION 6: COMPETITIVE HUB */}
          <section className="bg-[#0a1c2c] border border-[#173047] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  Tournaments & 1V1
                </h2>
              </div>
              <Link
                to="/contests"
                className="text-xs font-mono text-sky-400 hover:underline font-semibold"
              >
                All Contests →
              </Link>
            </div>

            {/* Contests Preview */}
            <div className="space-y-2">
              {contests.length === 0 ? (
                <div className="p-3 bg-[#0e2438] border border-[#1d3b56] rounded-lg text-center font-mono text-xs text-slate-400">
                  No active or upcoming tournaments right now
                </div>
              ) : (
                contests.slice(0, 2).map((c) => (
                  <div
                    key={c.id}
                    className="p-2.5 bg-[#0e2438] border border-[#1d3b56] rounded-lg flex items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <StatusBadge
                          status={c.status === 'live' ? 'live' : 'upcoming'}
                          size="xs"
                        />
                        <span className="text-[10px] font-mono text-slate-400">
                          {c.durationMinutes}m • {c.totalQuestions}Q
                        </span>
                      </div>
                      <h4 className="font-display font-semibold text-xs text-white truncate">
                        {c.title}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/contests/${c.id}`)}
                      className={`px-3 py-1 rounded text-xs font-bold shrink-0 cursor-pointer transition-all ${
                        c.status === 'live'
                          ? 'bg-[#ffd43b] hover:bg-[#facb15] text-[#071a2b]'
                          : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}
                    >
                      {c.status === 'live' ? 'Enter →' : 'View →'}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Direct Shortcuts */}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigate('/1v1')}
                className="p-2.5 bg-[#0e2438] hover:bg-[#122e47] border border-[#1d3b56] hover:border-slate-500/40 rounded-lg text-xs font-semibold text-white flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Swords className="w-3.5 h-3.5 text-amber-400" />
                  1V1 Arena
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/leaderboard')}
                className="p-2.5 bg-[#0e2438] hover:bg-[#122e47] border border-[#1d3b56] hover:border-slate-500/40 rounded-lg text-xs font-semibold text-white flex items-center justify-between transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5 text-sky-400" />
                  Leaderboard
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}