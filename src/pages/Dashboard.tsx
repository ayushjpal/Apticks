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
import { supabase } from '../lib/supabase'
import { ProfileService, type UserProfile } from '../services/profileService'
import { QuestionService } from '../services/questionService'
import { StreakService } from '../services/streakService'
import { ChallengeService } from '../services/challengeService'
import { ContestService } from '../services/contestService'
import type { UserStreak, DailyChallenge } from '../types/questions'
import type { Contest } from '../types/contests'
import AppLayout from '../components/layout/AppLayout'
import { NeoButton, StatusBadge } from '../components/ui'

export default function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [streakData, setStreakData] = useState<UserStreak | null>(null)
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

    const loadProfile = async () => {
      try {
        let user: { id: string; user_metadata?: Record<string, unknown> } | null = null

        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData?.session?.user) {
          user = sessionData.session.user
        } else {
          const {
            data: { user: fetchedUser },
            error: userError,
          } = await supabase.auth.getUser()

          if (!userError && fetchedUser) {
            user = fetchedUser
          }
        }

        if (!user) {
          if (isMounted) {
            navigate('/login', { replace: true })
          }
          return
        }

        let userProfile = await ProfileService.fetchProfile(user.id)
        const metaUsername = typeof user.user_metadata?.username === 'string' ? user.user_metadata.username : null
        const metaDisplayName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : metaUsername
        if (!userProfile?.username && metaUsername) {
          userProfile = {
            id: user.id,
            username: metaUsername,
            display_name: metaDisplayName,
            avatar_url: userProfile?.avatar_url || null,
            bio: userProfile?.bio || null,
            username_changed_at: userProfile?.username_changed_at || null,
          }
        }

        if (isMounted) {
          setProfile(userProfile)
        }

        try {
          const [
            userStreak,
            challenge,
            { questions, progressMap, challengeBonusXp },
            contestList,
          ] = await Promise.all([
            StreakService.getUserStreak(user.id),
            ChallengeService.getDailyChallenge(),
            QuestionService.getQuestionsWithProgress(user.id),
            ContestService.getContests(),
          ])

          if (isMounted) {
            setStreakData(userStreak)
            setDailyChallenge(challenge)
            setContests(contestList)
            const stats = QuestionService.calculateStats(questions, progressMap, [], challengeBonusXp)
            setQuestionStats(stats)
          }
        } catch (qErr) {
          console.warn('Could not load dashboard metrics:', qErr)
        }
      } catch (error) {
        console.error('Dashboard loading error:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#071a2b] flex items-center justify-center text-white">
        <div className="text-center font-display font-black">
          <div className="w-8 h-8 border-2 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs tracking-wider text-white/60">LOADING...</p>
        </div>
      </div>
    )
  }

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
    <AppLayout maxWidth="narrow">
      <div className="space-y-4 sm:space-y-5 animate-entry">
        {/* ================================================= */}
        {/* WORKSPACE WELCOME HEADER                          */}
        {/* ================================================= */}
        <section className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-[#0c1d2d]/60 uppercase tracking-wider mb-1">
                <Target className="w-3.5 h-3.5 text-[#0c1d2d]/70" />
                <span>Competitive Workspace</span>
              </div>
              <h1 className="font-display font-bold text-xl sm:text-2xl text-[#0c1d2d] tracking-tight leading-tight">
                Welcome back,{' '}
                <span className="font-semibold text-[#0c1d2d] bg-[#ffd43b]/40 px-2 py-0.5 rounded border border-[#0c1d2d]/15 inline-block">
                  @{username}
                </span>
              </h1>

              <p className="mt-1 text-xs sm:text-sm font-body text-[#0c1d2d]/70 leading-relaxed">
                Sharpen quantitative speed, beat the clock, and climb Season 01 rankings.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap sm:flex-nowrap lg:flex-col gap-2 shrink-0">
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
                Explore Contests
              </NeoButton>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* ARENA CORE: QUESTION BANK & DAILY CHALLENGE       */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 sm:gap-5">
          {/* Question Bank Practice Module */}
          <section className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs flex flex-col justify-between overflow-hidden">
            <div>
              <div className="p-3.5 sm:p-4 border-b border-[#0c1d2d]/8 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center font-display font-bold text-amber-900 text-sm">
                    Q
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-sm text-[#0c1d2d] leading-none">
                      Question Bank
                    </h2>
                    <span className="text-[11px] font-medium text-slate-500">
                      Progressive Speed Practice
                    </span>
                  </div>
                </div>

                <Link
                  to="/questions"
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#0c1d2d]/15 rounded-lg text-xs font-semibold text-[#0c1d2d] flex items-center gap-1 shadow-xs transition-colors"
                >
                  <span>All Problems</span>
                  <ArrowRight className="w-3 h-3 text-[#0c1d2d]/60" />
                </Link>
              </div>

              {/* Progress Summary Blocks */}
              <div className="p-3.5 sm:p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 border border-[#0c1d2d]/8 rounded-lg">
                    <div className="font-display font-bold text-lg text-[#0c1d2d]">
                      {solvedCount} <span className="text-xs font-normal text-slate-500">/ {totalQuestions}</span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                      Problems Completed
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-[#ffd43b] rounded-full"
                        style={{
                          width: `${(solvedCount / Math.max(totalQuestions, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-[#0c1d2d]/8 rounded-lg">
                    <div className="font-display font-bold text-lg text-[#0c1d2d]">
                      {accuracyRate}%
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                      Solver Accuracy
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${accuracyRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Topics strip */}
                <div className="p-3 bg-slate-50 border border-[#0c1d2d]/8 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="text-xs font-semibold text-[#0c1d2d]">
                      Practice Domains
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Quantitative • Logical Reasoning • Data Interpretation
                    </div>
                  </div>

                  <Link
                    to="/questions"
                    className="px-3 py-1.5 bg-[#ffd43b] hover:bg-[#fcc828] border border-[#0c1d2d]/20 rounded-lg text-xs font-semibold text-[#0c1d2d] shadow-xs text-center shrink-0 transition-colors"
                  >
                    Start Solving →
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 border-t border-[#0c1d2d]/8 bg-white flex items-center justify-between text-xs font-mono text-slate-500">
              <span>{totalQuestions - solvedCount} problems remaining</span>
              <span
                className="text-sky-600 font-semibold cursor-pointer hover:underline"
                onClick={() => navigate('/questions')}
              >
                Open Practice →
              </span>
            </div>
          </section>

          {/* Daily Challenge Card */}
          <section className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs flex flex-col justify-between p-4 sm:p-5 overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-[#0c1d2d]/8">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span className="font-display font-bold text-xs uppercase tracking-wide text-[#0c1d2d]">
                    Daily Challenge
                  </span>
                </div>
                <div className="bg-amber-50 text-amber-900 border border-amber-200 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold">
                  +{dailyChallenge?.bonusXp ?? 50} BONUS XP
                </div>
              </div>

              <div className="mt-3 bg-slate-50 border border-[#0c1d2d]/8 rounded-lg p-3.5 sm:p-4">
                <div className="flex items-center justify-between mb-1.5">
                  {dailyChallenge ? (
                    <StatusBadge
                      status={dailyChallenge.question.difficulty}
                      size="xs"
                      label={`${dailyChallenge.question.difficulty.toUpperCase()} • ${dailyChallenge.question.category.toUpperCase()}`}
                    />
                  ) : (
                    <span className="bg-slate-200 text-slate-700 rounded-full px-2 py-0.5 text-[9px] font-medium">
                      Daily Arena
                    </span>
                  )}
                  <div className="flex items-center gap-1 font-mono text-xs text-slate-600">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{dailyChallenge ? formatTimeLeft(dailyChallenge.secondsLeft) : 'Standby'}</span>
                  </div>
                </div>

                <h3 className="font-display font-bold text-sm sm:text-base text-[#0c1d2d] leading-snug mt-1.5">
                  {dailyChallenge?.question.title || "Daily Challenge Arena"}
                </h3>

                <p className="mt-1 text-xs font-body text-slate-600 leading-relaxed line-clamp-2">
                  {dailyChallenge?.question.prompt || "Today's speed challenge is loading or currently unavailable. Please verify your connection."}
                </p>

                {dailyChallenge?.isCompleted ? (
                  <div className="mt-3 w-full py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 cursor-default">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Completed (+{dailyChallenge.bonusXpAwarded || dailyChallenge.bonusXp} XP)</span>
                  </div>
                ) : dailyChallenge ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/questions/${dailyChallenge.question.id}?challenge=true&challengeId=${dailyChallenge.challengeId}`)
                    }}
                    className="mt-3 w-full py-2 bg-[#ffd43b] hover:bg-[#fcc828] text-[#0c1d2d] border border-[#0c1d2d]/20 rounded-lg font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 fill-[#0c1d2d] text-[#0c1d2d] shrink-0" />
                    <span>Accept Challenge →</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-3 w-full py-2 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-xs font-medium cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Currently Unavailable</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-[#0c1d2d]/8 flex items-center justify-between text-xs font-mono text-slate-600">
              <div className="flex items-center gap-1.5">
                <span>Streak: {streakData?.currentStreak ?? 0} {(streakData?.currentStreak ?? 0) === 1 ? 'day' : 'days'}</span>
                {streakData?.isActiveToday && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.2 text-[9px] font-medium">
                    Active
                  </span>
                )}
                {streakData?.isAtRisk && (
                  <span className="bg-rose-50 text-rose-700 border border-rose-200 rounded-full px-1.5 py-0.2 text-[9px] font-medium">
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
          <section className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-[#0c1d2d]/8 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h2 className="font-display font-bold text-sm text-[#0c1d2d] leading-none">
                  Upcoming Contests
                </h2>
              </div>

              <Link
                to="/contests"
                className="px-2.5 py-1 bg-white hover:bg-slate-50 border border-[#0c1d2d]/15 rounded-lg text-xs font-semibold text-[#0c1d2d] flex items-center gap-1 shadow-xs transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="w-3 h-3 text-[#0c1d2d]/60" />
              </Link>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5">
              {contests.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-[#0c1d2d]/8 rounded-lg text-center font-mono text-xs text-slate-500">
                  No active or upcoming tournaments
                </div>
              ) : (
                contests.slice(0, 2).map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-[#0c1d2d]/8 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <StatusBadge
                          status={c.status === 'live' ? 'live' : 'upcoming'}
                          size="xs"
                        />
                        <span className="text-[11px] font-mono text-slate-500">
                          {c.durationMinutes}m • {c.totalQuestions}Q
                        </span>
                      </div>
                      <h4 className="font-display font-semibold text-sm text-[#0c1d2d]">
                        {c.title}
                      </h4>
                      <p className="text-[11px] font-body text-slate-500 mt-0.5">
                        {c.category} • {c.difficulty}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/contests/${c.id}`)}
                      className={`px-3 py-1.5 border rounded-lg text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                        c.status === 'live'
                          ? 'bg-[#ffd43b] hover:bg-[#fcc828] text-[#0c1d2d] border-[#0c1d2d]/20 shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-[#0c1d2d] border-[#0c1d2d]/15 shadow-xs'
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
          <section className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="pb-2.5 border-b border-[#0c1d2d]/8 flex items-center justify-between">
                <span className="font-display font-bold text-xs uppercase tracking-wide text-[#0c1d2d]">
                  Quick Navigation
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => navigate('/questions')}
                  className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 border border-[#0c1d2d]/8 rounded-lg text-xs font-medium text-left flex items-center justify-between transition-colors cursor-pointer text-[#0c1d2d]"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    Practice Question Bank
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/leaderboard')}
                  className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 border border-[#0c1d2d]/8 rounded-lg text-xs font-medium text-left flex items-center justify-between transition-colors cursor-pointer text-[#0c1d2d]"
                >
                  <span className="flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-slate-500" />
                    Global Leaderboard
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 border border-[#0c1d2d]/8 rounded-lg text-xs font-medium text-left flex items-center justify-between transition-colors cursor-pointer text-[#0c1d2d]"
                >
                  <span className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-slate-500" />
                    Profile & Settings
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Motto */}
            <div className="mt-4 pt-2.5 border-t border-[#0c1d2d]/8 text-center font-mono text-[10px] text-slate-400 tracking-wider uppercase">
              Apticks • Think Fast • Solve Accurate
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  )
}