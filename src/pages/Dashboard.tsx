import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Trophy,
  Zap,
  Target,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  Flame,
  Clock,
  ChevronRight,
  BarChart2,
} from 'lucide-react'
import { QuestionService } from '../services/questionService'
import { ChallengeService } from '../services/challengeService'
import { ContestService } from '../services/contestService'
import type { DailyChallenge } from '../types/questions'
import type { Contest } from '../types/contests'
import { useUserSession } from '../contexts/UserSessionContext'
import { NeoButton, StatusBadge } from '../components/ui'

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
  const [questionStats, setQuestionStats] = useState<{
    totalQuestions: number
    solvedCount: number
    accuracyRate: number
    totalPoints: number
  } | null>(null)

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
        ] = await Promise.all([
          ChallengeService.getDailyChallenge(),
          QuestionService.getQuestionsWithProgress(user.id),
          ContestService.getContests(),
        ])

        if (isMounted) {
          setDailyChallenge(challenge)
          setContests(contestList)
          const stats = QuestionService.calculateStats(
            questions,
            progressMap,
            [],
            challengeBonusXp,
            contestXp
          )
          setQuestionStats(stats)
        }
      } catch (error) {
        console.error('Dashboard loading error:', error)
      }
    }

    loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [user, sessionLoading, navigate])

  const username = profile?.username || profile?.display_name || 'player'
  const solvedCount = questionStats?.solvedCount ?? 0
  const totalQuestions = questionStats?.totalQuestions ?? 30
  const accuracyRate = questionStats?.accuracyRate ?? 0

  const formatTimeLeft = (seconds: number) => {
    if (seconds <= 0) return 'Ending soon'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${h}h ${m}m left`
  }

  return (
    <div className="max-w-[1160px] mx-auto space-y-4 sm:space-y-5 animate-entry">
      <div className="space-y-4 sm:space-y-5 animate-entry">
        {/* ================================================= */}
        {/* COMPETITIVE COMMAND BASE // PLAYER STATUS HUD     */}
        {/* ================================================= */}
        <section className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ARENA COMMAND BASE // SEASON 01</span>
              </div>
              <h1 className="font-display font-black text-xl sm:text-2xl text-white tracking-tight leading-tight flex items-center gap-2 flex-wrap">
                <span>OPERATIONAL STATUS:</span>
                <span className="bg-[#ffd43b]/20 text-[#ffd43b] px-2 py-0.5 rounded border border-[#ffd43b]/40 inline-flex items-center gap-1 font-mono text-base sm:text-lg">
                  @{username}
                </span>
              </h1>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
              <NeoButton
                variant="primary"
                size="md"
                onClick={() => navigate('/questions')}
                icon={<BookOpen className="w-4 h-4 shrink-0" />}
                iconRight={<ArrowRight className="w-4 h-4 shrink-0" />}
              >
                Continue Practice
              </NeoButton>

              <NeoButton
                variant="secondary"
                size="md"
                onClick={() => navigate('/contests')}
                icon={<Trophy className="w-3.5 h-3.5 shrink-0" />}
              >
                Tournaments
              </NeoButton>
            </div>
          </div>

          {/* 4-Tile High-Density Player HUD */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {/* Tile 1: Level & Tier */}
            <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                <span>CURRENT LEVEL</span>
                <span className="text-[#0c1d2d] bg-[#ffd43b] px-1.5 py-0.2 rounded font-black">
                  LVL {String(levelProgress?.level ?? 1).padStart(2, '0')}
                </span>
              </div>
              <div className="my-2">
                <div className="font-display font-black text-base sm:text-lg text-white leading-none">
                  {levelProgress?.title ?? 'Novice'}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  {levelProgress?.xpInLevel ?? 0} / {(levelProgress?.nextLevelXp ?? 100) - (levelProgress?.currentLevelXp ?? 0)} XP
                </div>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ffd43b] rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(255,212,59,0.5)]"
                  style={{ width: `${levelProgress?.progressPercentage ?? 0}%` }}
                />
              </div>
            </div>

            {/* Tile 2: XP */}
            <div className="p-3 bg-amber-400/[0.06] border border-amber-400/25 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider">
                <span>TOTAL XP</span>
                <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              </div>
              <div className="my-2">
                <div className="font-display font-black text-2xl sm:text-3xl text-white leading-none">
                  {levelProgress?.totalXp ?? questionStats?.totalPoints ?? 0}
                  <span className="text-xs font-mono font-bold text-[#ffd43b] ml-1">XP</span>
                </div>
              </div>
              <div className="text-[10px] font-mono text-amber-300 font-medium truncate">
                {levelProgress?.xpRequired ?? 0} XP to Level {(levelProgress?.level ?? 1) + 1}
              </div>
            </div>

            {/* Tile 3: Streak */}
            <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                <span>ACTIVE STREAK</span>
                <Flame className={`w-3.5 h-3.5 ${streakData?.isActiveToday ? 'text-rose-500 fill-rose-500' : 'text-slate-400'}`} />
              </div>
              <div className="my-2">
                <div className="font-display font-black text-2xl sm:text-3xl text-white leading-none">
                  {streakData?.currentStreak ?? 0}
                  <span className="text-xs font-mono font-bold text-slate-400 ml-1">DAYS</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-400">Best: {streakData?.longestStreak ?? 0}d</span>
                {streakData?.isActiveToday ? (
                  <span className="text-emerald-400 font-bold">Active Today</span>
                ) : (
                  <span className="text-rose-400 font-bold">Needs Solve</span>
                )}
              </div>
            </div>

            {/* Tile 4: Competitive Standing */}
            <div className="p-3 bg-white/[0.04] border border-white/10 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                <span>GLOBAL STANDING</span>
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="my-2">
                <div className="font-display font-black text-2xl sm:text-3xl text-white leading-none">
                  {userRank ? `#${userRank}` : 'STANDBY'}
                </div>
              </div>
              <Link
                to="/leaderboard"
                className="text-[10px] font-mono text-sky-400 hover:underline font-bold flex items-center gap-1"
              >
                <span>Arena Standings</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </Link>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* ARENA CORE: QUESTION BANK & DAILY CHALLENGE       */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 sm:gap-5">
          {/* Question Bank Practice Module */}
          <section className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden">
            <div>
              <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#ffd43b]/15 border border-[#ffd43b]/30 flex items-center justify-center font-display font-bold text-[#ffd43b] text-sm">
                    Q
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm text-white leading-none">
                      Question Bank
                    </h2>
                    <span className="text-[11px] font-medium text-slate-400">
                      Progressive Speed Practice
                    </span>
                  </div>
                </div>

                <Link
                  to="/questions"
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg text-xs font-semibold text-white flex items-center gap-1 shadow-xs transition-colors"
                >
                  <span>All Problems</span>
                  <ArrowRight className="w-3 h-3 text-slate-300" />
                </Link>
              </div>

              {/* Progress Summary Blocks */}
              <div className="p-3.5 sm:p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white/[0.04] border border-white/10 rounded-lg">
                    <div className="font-display font-bold text-lg text-white">
                      {solvedCount} <span className="text-xs font-normal text-slate-400">/ {totalQuestions}</span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                      Problems Completed
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-[#ffd43b] rounded-full shadow-[0_0_8px_rgba(255,212,59,0.5)]"
                        style={{
                          width: `${(solvedCount / Math.max(totalQuestions, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-white/[0.04] border border-white/10 rounded-lg">
                    <div className="font-display font-bold text-lg text-white">
                      {accuracyRate}%
                    </div>
                    <div className="text-[11px] font-medium text-slate-400 mt-0.5">
                      Solver Accuracy
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-sky-400 rounded-full shadow-[0_0_8px_rgba(56,174,240,0.5)]"
                        style={{ width: `${accuracyRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Topics strip */}
                <div className="p-3 bg-white/[0.04] border border-white/10 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Practice Domains
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Quantitative • Logical Reasoning • Data Interpretation
                    </div>
                  </div>

                  <Link
                    to="/questions"
                    className="px-3 py-1.5 bg-[#ffd43b] hover:bg-[#facb15] border border-amber-400/80 rounded-lg text-xs font-bold text-[#0c1d2d] shadow-[0_0_15px_rgba(255,212,59,0.2)] hover:shadow-[0_0_20px_rgba(255,212,59,0.35)] hover:-translate-y-0.5 active:translate-y-0 text-center shrink-0 transition-all"
                  >
                    Start Solving →
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 border-t border-white/10 bg-black/20 flex items-center justify-between text-xs font-mono text-slate-400">
              <span>{totalQuestions - solvedCount} problems remaining</span>
              <span
                className="text-sky-400 font-semibold cursor-pointer hover:underline"
                onClick={() => navigate('/questions')}
              >
                Open Practice →
              </span>
            </div>
          </section>

          {/* Daily Challenge Card (Key card with accent border per spec) */}
          <section className="bg-slate-900/60 backdrop-blur-md border-2 border-amber-400/60 ring-1 ring-amber-400/20 rounded-2xl shadow-[0_0_20px_rgba(255,212,59,0.08)] flex flex-col justify-between p-4 sm:p-5 overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="font-display font-bold text-xs uppercase tracking-wide text-white">
                    Daily Challenge
                  </span>
                </div>
                <div className="bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold">
                  +{dailyChallenge?.bonusXp ?? 50} BONUS XP
                </div>
              </div>

              <div className="mt-3 bg-white/[0.04] border border-white/10 rounded-xl p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-1.5">
                  {dailyChallenge ? (
                    <StatusBadge
                      status={dailyChallenge.question.difficulty}
                      size="xs"
                      label={`${dailyChallenge.question.difficulty.toUpperCase()} • ${dailyChallenge.question.category.toUpperCase()}`}
                    />
                  ) : (
                    <span className="bg-white/10 text-slate-300 border border-white/10 rounded-full px-2 py-0.5 text-[9px] font-medium">
                      Daily Arena
                    </span>
                  )}
                  <div className="flex items-center gap-1 font-mono text-xs text-slate-400">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{dailyChallenge ? formatTimeLeft(dailyChallenge.secondsLeft) : 'Standby'}</span>
                  </div>
                </div>

                <h3 className="font-display font-bold text-sm sm:text-base text-white leading-snug mt-1.5">
                  {dailyChallenge?.question.title || "Daily Challenge Arena"}
                </h3>

                <p className="mt-1 text-xs font-body text-slate-300 leading-relaxed line-clamp-2">
                  {dailyChallenge?.question.prompt || "Today's speed challenge is loading or currently unavailable. Please verify your connection."}
                </p>

                {dailyChallenge?.isCompleted ? (
                  <div className="mt-3 w-full py-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 cursor-default">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Completed (+{dailyChallenge.bonusXpAwarded || dailyChallenge.bonusXp} XP)</span>
                  </div>
                ) : dailyChallenge ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/questions/${dailyChallenge.question.id}?challenge=true&challengeId=${dailyChallenge.challengeId}`)
                    }}
                    className="mt-3 w-full py-2 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-lg font-bold text-xs shadow-[0_0_15px_rgba(255,212,59,0.25)] hover:shadow-[0_0_22px_rgba(255,212,59,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 fill-[#0c1d2d] text-[#0c1d2d] shrink-0" />
                    <span>Accept Challenge →</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-3 w-full py-2 bg-white/5 text-slate-500 border border-white/10 rounded-lg text-xs font-medium cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Currently Unavailable</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
              <div className="flex items-center gap-1.5">
                <span>Streak: {streakData?.currentStreak ?? 0} {(streakData?.currentStreak ?? 0) === 1 ? 'day' : 'days'}</span>
                {streakData?.isActiveToday && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-1.5 py-0.2 text-[9px] font-medium">
                    Active
                  </span>
                )}
                {streakData?.isAtRisk && (
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full px-1.5 py-0.2 text-[9px] font-medium">
                    At Risk
                  </span>
                )}
              </div>
              <span>Best: {streakData?.longestStreak ?? 0}</span>
            </div>
          </section>
        </div>

        {/* ================================================= */}
        {/* LOWER DECK: UPCOMING CONTESTS & QUICK NAV         */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 sm:gap-5">
          {/* Upcoming Contests */}
          <section className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h2 className="font-display font-bold text-sm text-white leading-none">
                  Upcoming Contests
                </h2>
              </div>

              <Link
                to="/contests"
                className="px-2.5 py-1 bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg text-xs font-semibold text-white flex items-center gap-1 shadow-xs transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3 text-slate-300" />
              </Link>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5">
              {contests.length === 0 ? (
                <div className="p-4 bg-white/[0.03] border border-white/10 rounded-lg text-center font-mono text-xs text-slate-400">
                  No active or upcoming tournaments
                </div>
              ) : (
                contests.slice(0, 2).map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <StatusBadge
                          status={c.status === 'live' ? 'live' : 'upcoming'}
                          size="xs"
                        />
                        <span className="text-[11px] font-mono text-slate-400">
                          {c.durationMinutes}m • {c.totalQuestions}Q
                        </span>
                      </div>
                      <h4 className="font-display font-semibold text-sm text-white">
                        {c.title}
                      </h4>
                      <p className="text-[11px] font-body text-slate-400 mt-0.5">
                        {c.category} • {c.difficulty}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/contests/${c.id}`)}
                      className={`px-3 py-1.5 border rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-all ${
                        c.status === 'live'
                          ? 'bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border-amber-400/80 shadow-[0_0_12px_rgba(255,212,59,0.3)] hover:-translate-y-0.5 active:translate-y-0'
                          : 'bg-white/10 hover:bg-white/15 text-white border-white/15 shadow-xs hover:-translate-y-0.5 active:translate-y-0'
                      }`}
                    >
                      {c.status === 'live' ? 'Enter →' : 'View →'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Quick Hub Navigation Actions */}
          <section className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="pb-2.5 border-b border-white/10 flex items-center justify-between">
                <span className="font-display font-bold text-xs uppercase tracking-wide text-white">
                  Quick Navigation
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => navigate('/questions')}
                  className="w-full p-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-xs font-medium text-left flex items-center justify-between transition-colors cursor-pointer text-white"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    Practice Question Bank
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/leaderboard')}
                  className="w-full p-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-xs font-medium text-left flex items-center justify-between transition-colors cursor-pointer text-white"
                >
                  <span className="flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
                    Global Leaderboard
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="w-full p-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-lg text-xs font-medium text-left flex items-center justify-between transition-colors cursor-pointer text-white"
                >
                  <span className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-slate-400" />
                    Profile & Settings
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Motto */}
            <div className="mt-4 pt-2.5 border-t border-white/10 text-center font-mono text-[10px] text-slate-400 tracking-wider uppercase">
              Apticks • Think Fast • Solve Accurate
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}