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
    <AppLayout>
      <div className="max-w-[1160px] mx-auto space-y-4 sm:space-y-5 animate-entry">
        {/* ================================================= */}
        {/* HERO SECTION — CLEAN & PROFESSIONAL               */}
        {/* ================================================= */}
        <section className="bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] p-4 sm:p-6 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-5 relative z-10">
            <div className="max-w-xl">
              <h1 className="font-display font-black text-xl sm:text-2xl lg:text-3xl uppercase tracking-tight text-[#0c1d2d] leading-tight">
                Welcome back,{' '}
                <span className="text-[#0c1d2d] bg-[#ffd43b] px-2 py-0.5 border-[1.5px] border-[#0c1d2d] rounded-lg inline-block">
                  @{username}
                </span>
              </h1>

              <p className="mt-1.5 text-xs sm:text-sm font-body font-semibold text-black/60 leading-relaxed">
                Sharpen your quantitative speed and beat the clock.
              </p>
            </div>

            {/* Hero Action Buttons */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/questions')}
                className="px-5 py-2.5 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] font-display font-black text-xs sm:text-sm tracking-wider uppercase transition-all hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#0c1d2d] cursor-pointer flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>CONTINUE PRACTICE</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/contests')}
                className="px-5 py-2.5 bg-white hover:bg-[#f8fafc] text-[#0c1d2d] border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d] font-display font-black text-xs tracking-wider uppercase transition-all hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#0c1d2d] cursor-pointer flex items-center justify-center gap-2"
              >
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                <span>EXPLORE CONTESTS</span>
              </button>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* ARENA CORE: QUESTION BANK & DAILY CHALLENGE       */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 sm:gap-5">
          {/* Question Bank Practice Module */}
          <section className="bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] flex flex-col justify-between overflow-hidden">
            <div>
              <div className="p-3.5 sm:p-4 border-b-[1.5px] border-[#0c1d2d]/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-[#ffd43b] border-[1.5px] border-[#0c1d2d] rounded-lg flex items-center justify-center font-display font-black text-xs shadow-[1.5px_1.5px_0_#0c1d2d]">
                    Q
                  </div>
                  <div>
                    <h2 className="font-display font-black text-sm uppercase text-[#0c1d2d] leading-none">
                      QUESTION BANK
                    </h2>
                    <span className="font-mono text-[9px] font-bold text-black/40 uppercase">
                      SPEED PRACTICE
                    </span>
                  </div>
                </div>

                <Link
                  to="/questions"
                  className="px-3 py-1 bg-[#ffd43b] hover:bg-[#facc15] border-[1.5px] border-[#0c1d2d] rounded-lg font-display font-black text-[11px] uppercase shadow-[1.5px_1.5px_0_#0c1d2d] flex items-center gap-1 transition-transform hover:-translate-y-0.5"
                >
                  <span>ALL PROBLEMS</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Progress Summary Blocks */}
              <div className="p-3.5 sm:p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-[#faf9f6] border-[1.5px] border-[#0c1d2d]/20 rounded-xl">
                    <div className="font-display font-black text-xl text-[#0c1d2d]">
                      {solvedCount} / {totalQuestions}
                    </div>
                    <div className="font-display font-black text-[10px] uppercase text-black/50 mt-0.5">
                      PROBLEMS COMPLETED
                    </div>
                    <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-[#ffd43b] rounded-full"
                        style={{
                          width: `${(solvedCount / Math.max(totalQuestions, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-[#faf9f6] border-[1.5px] border-[#0c1d2d]/20 rounded-xl">
                    <div className="font-display font-black text-xl text-[#0c1d2d]">
                      {accuracyRate}%
                    </div>
                    <div className="font-display font-black text-[10px] uppercase text-black/50 mt-0.5">
                      SOLVER ACCURACY
                    </div>
                    <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-[#38aef0] rounded-full"
                        style={{ width: `${accuracyRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Topics strip */}
                <div className="p-3 bg-[#faf9f6] border-[1.5px] border-[#0c1d2d]/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="font-display font-black text-xs uppercase text-[#0c1d2d]">
                      PRACTICE DOMAINS
                    </div>
                    <div className="text-[11px] font-body font-bold text-black/50 mt-0.5">
                      Quantitative • Logical • Data Interpretation
                    </div>
                  </div>

                  <Link
                    to="/questions"
                    className="px-3 py-1.5 bg-[#ffd43b] hover:bg-[#facc15] border-[1.5px] border-[#0c1d2d] rounded-lg font-display font-black text-xs uppercase shadow-[1.5px_1.5px_0_#0c1d2d] text-center shrink-0 transition-transform hover:-translate-y-0.5"
                  >
                    START SOLVING →
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 border-t-[1.5px] border-[#0c1d2d]/15 bg-white flex items-center justify-between text-xs font-mono font-bold text-black/50">
              <span>{totalQuestions - solvedCount} problems remaining</span>
              <span
                className="text-[#38aef0] font-black cursor-pointer hover:underline"
                onClick={() => navigate('/questions')}
              >
                Open Practice →
              </span>
            </div>
          </section>

          {/* Daily Challenge Card */}
          <section className="bg-[#ffd43b] border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] flex flex-col justify-between p-4 sm:p-5 overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b-[1.5px] border-[#0c1d2d]/20">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 fill-[#0c1d2d] text-[#0c1d2d]" />
                  <span className="font-display font-black text-xs uppercase text-[#0c1d2d]">
                    DAILY CHALLENGE
                  </span>
                </div>
                <div className="bg-[#ff5b5b] text-white border-[1.5px] border-[#0c1d2d] rounded-full px-2 py-0.5 font-mono text-[9px] font-black uppercase shadow-[1px_1px_0_#0c1d2d]">
                  +{dailyChallenge?.bonusXp ?? 50} BONUS XP
                </div>
              </div>

              <div className="mt-3 bg-white border-[1.5px] border-[#0c1d2d] rounded-xl p-3.5 sm:p-4 shadow-[2px_2px_0_#0c1d2d]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="bg-[#0c1d2d] text-white border-[1.5px] border-[#0c1d2d] rounded-full px-2 py-0.5 text-[9px] font-display font-black uppercase">
                    {dailyChallenge ? `${dailyChallenge.question.difficulty.toUpperCase()} • ${dailyChallenge.question.category.toUpperCase()}` : 'DAILY ARENA'}
                  </span>
                  <div className="flex items-center gap-1 font-mono text-[11px] font-black text-[#0c1d2d]">
                    <Clock className="w-3 h-3" />
                    <span>{dailyChallenge ? formatTimeLeft(dailyChallenge.secondsLeft) : 'STANDBY'}</span>
                  </div>
                </div>

                <h3 className="font-display font-black text-base uppercase text-[#0c1d2d] leading-tight mt-1.5">
                  {dailyChallenge?.question.title || "DAILY CHALLENGE ARENA"}
                </h3>

                <p className="mt-1 text-xs font-body font-semibold text-black/60 leading-relaxed line-clamp-2">
                  {dailyChallenge?.question.prompt || "Today's speed challenge is loading or currently unavailable. Please verify your connection."}
                </p>

                {dailyChallenge?.isCompleted ? (
                  <div className="mt-3 w-full py-2.5 bg-[#32e875] text-[#0c1d2d] border-[1.5px] border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#0c1d2d] flex items-center justify-center gap-1.5 cursor-default">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>COMPLETED (+{dailyChallenge.bonusXpAwarded || dailyChallenge.bonusXp} XP)</span>
                  </div>
                ) : dailyChallenge ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/questions/${dailyChallenge.question.id}?challenge=true&challengeId=${dailyChallenge.challengeId}`)
                    }}
                    className="mt-3 w-full py-2.5 bg-[#32e875] hover:bg-[#22c55e] text-[#0c1d2d] border-[1.5px] border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2px_2px_0_#0c1d2d] transition-all hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5 fill-[#0c1d2d] shrink-0" />
                    <span>ACCEPT CHALLENGE →</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-3 w-full py-2.5 bg-slate-100 text-black/40 border-[1.5px] border-[#0c1d2d]/30 rounded-xl font-display font-black text-xs uppercase tracking-wider cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-black/30 shrink-0" />
                    <span>CURRENTLY UNAVAILABLE</span>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t-[1.5px] border-[#0c1d2d]/15 flex items-center justify-between text-[10px] font-mono font-black text-[#0c1d2d]/70">
              <div className="flex items-center gap-1.5">
                <span>STREAK: {streakData?.currentStreak ?? 0} {(streakData?.currentStreak ?? 0) === 1 ? 'DAY' : 'DAYS'}</span>
                {streakData?.isActiveToday && (
                  <span className="bg-[#32e875] text-[#0c1d2d] border border-[#0c1d2d]/30 rounded-full px-1.5 py-0.2 text-[8px] font-display font-black">
                    ACTIVE
                  </span>
                )}
                {streakData?.isAtRisk && (
                  <span className="bg-[#ff5b5b] text-white border border-[#0c1d2d]/30 rounded-full px-1.5 py-0.2 text-[8px] font-display font-black">
                    AT RISK
                  </span>
                )}
              </div>
              <span>BEST: {streakData?.longestStreak ?? 0}</span>
            </div>
          </section>
        </div>

        {/* ================================================= */}
        {/* LOWER DECK: UPCOMING CONTESTS & QUICK NAV         */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 sm:gap-5">
          {/* Upcoming Contests */}
          <section className="bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b-[1.5px] border-[#0c1d2d]/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-4 h-4 text-[#0c1d2d]" />
                <h2 className="font-display font-black text-sm uppercase text-[#0c1d2d] leading-none">
                  UPCOMING CONTESTS
                </h2>
              </div>

              <Link
                to="/contests"
                className="px-3 py-1 bg-[#ffd43b] hover:bg-[#facc15] border-[1.5px] border-[#0c1d2d] rounded-lg font-display font-black text-[11px] uppercase shadow-[1.5px_1.5px_0_#0c1d2d] flex items-center gap-1 transition-transform hover:-translate-y-0.5"
              >
                <span>VIEW ALL</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5">
              {contests.length === 0 ? (
                <div className="p-4 bg-[#faf9f6] border-[1.5px] border-[#0c1d2d]/15 rounded-xl text-center font-mono text-xs font-bold text-black/40">
                  NO ACTIVE OR UPCOMING TOURNAMENTS
                </div>
              ) : (
                contests.slice(0, 2).map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-white border-[1.5px] border-[#0c1d2d]/20 rounded-xl shadow-[2px_2px_0_#0c1d2d]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#faf9f6] transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {c.status === 'live' ? (
                          <span className="bg-[#ff5b5b] text-white border border-[#0c1d2d]/30 rounded-full px-2 py-0.2 text-[8px] font-display font-black uppercase animate-pulse">
                            LIVE NOW
                          </span>
                        ) : (
                          <span className="bg-[#38aef0]/15 text-[#0c1d2d] border border-[#0c1d2d]/20 rounded-full px-2 py-0.2 text-[8px] font-display font-black uppercase">
                            SCHEDULED
                          </span>
                        )}
                        <span className="text-[11px] font-mono font-bold text-black/40">
                          {c.durationMinutes} MINS • {c.totalQuestions} Q
                        </span>
                      </div>
                      <h4 className="font-display font-black text-sm uppercase text-[#0c1d2d]">
                        {c.title}
                      </h4>
                      <p className="text-[11px] font-body font-semibold text-black/40 mt-0.5">
                        {c.category} • {c.difficulty.toUpperCase()}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/contests/${c.id}`)}
                      className={`px-3 py-1.5 border-[1.5px] border-[#0c1d2d] rounded-lg font-display font-black text-xs uppercase shadow-[1.5px_1.5px_0_#0c1d2d] shrink-0 transition-transform hover:-translate-y-0.5 cursor-pointer ${
                        c.status === 'live'
                          ? 'bg-[#ffd43b] hover:bg-[#facc15]'
                          : 'bg-white hover:bg-[#faf9f6]'
                      }`}
                    >
                      {c.status === 'live' ? 'ENTER →' : 'VIEW →'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Quick Hub Navigation Actions */}
          <section className="bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="pb-2.5 border-b-[1.5px] border-[#0c1d2d]/15 flex items-center justify-between">
                <span className="font-display font-black text-xs uppercase text-[#0c1d2d]">
                  QUICK NAVIGATION
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => navigate('/questions')}
                  className="w-full p-2.5 bg-[#faf9f6] hover:bg-[#f1f5f9] border-[1.5px] border-[#0c1d2d]/15 rounded-xl font-display font-black text-xs uppercase text-left flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#0c1d2d]" />
                    PRACTICE QUESTION BANK
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-black/30" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/leaderboard')}
                  className="w-full p-2.5 bg-[#faf9f6] hover:bg-[#f1f5f9] border-[1.5px] border-[#0c1d2d]/15 rounded-xl font-display font-black text-xs uppercase text-left flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-[#0c1d2d]" />
                    GLOBAL LEADERBOARD
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-black/30" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="w-full p-2.5 bg-[#faf9f6] hover:bg-[#f1f5f9] border-[1.5px] border-[#0c1d2d]/15 rounded-xl font-display font-black text-xs uppercase text-left flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-[#0c1d2d]" />
                    PROFILE & SETTINGS
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-black/30" />
                </button>
              </div>
            </div>

            {/* Motto */}
            <div className="mt-4 pt-2.5 border-t-[1.5px] border-[#0c1d2d]/10 text-center font-mono text-[9px] font-bold text-black/30 tracking-widest uppercase">
              APTICKS • THINK FAST • SOLVE ACCURATE
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  )
}