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
  Sparkles,
  BarChart2,
  Shield,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ProfileService, type UserProfile } from '../services/profileService'
import { QuestionService } from '../services/questionService'
import AppLayout from '../components/layout/AppLayout'

export default function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
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
          const { questions, progressMap } =
            await QuestionService.getQuestionsWithProgress(user.id)
          const stats = QuestionService.calculateStats(questions, progressMap)
          if (isMounted) {
            setQuestionStats(stats)
          }
        } catch (qErr) {
          console.warn('Could not load dashboard question stats:', qErr)
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
          <div className="w-10 h-10 border-3 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs tracking-wider">LOADING ARENA...</p>
        </div>
      </div>
    )
  }

  const username = profile?.username || profile?.display_name || 'player'
  const solvedCount = questionStats?.solvedCount ?? 0
  const totalQuestions = questionStats?.totalQuestions ?? 30
  const accuracyRate = questionStats?.accuracyRate ?? 0
  const totalPoints = questionStats?.totalPoints ?? 0

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-5 animate-entry">
        {/* ================================================= */}
        {/* HERO ARENA SECTION — COMPACT & DOMINANT           */}
        {/* ================================================= */}
        <section className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-[6px_6px_0_#38aef0] p-4 sm:p-6 lg:p-7 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6 relative z-10">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-1.5 bg-[#38aef0] text-black border-2 border-black rounded-full px-2.5 py-0.5 text-[9px] font-mono font-black tracking-widest uppercase shadow-[1.5px_1.5px_0_#000000] mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#32e875] border border-black animate-pulse" />
                <span>ARENA ONLINE • SEASON 01 PREVIEW</span>
              </div>

              <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl uppercase tracking-tight text-black leading-tight">
                WELCOME BACK,{' '}
                <span className="text-[#071a2b] bg-[#ffd43b] px-2 py-0.5 border-2 border-black rounded-lg inline-block">
                  @{username}
                </span>
              </h1>

              <p className="mt-1.5 text-xs sm:text-sm font-body font-semibold text-black/75 leading-relaxed">
                Step into the arena, sharpen your quantitative speed, and beat the clock.
              </p>
            </div>

            {/* Dominant Hero Action Buttons */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => navigate('/questions')}
                className="px-5 sm:px-6 py-2.5 sm:py-3 bg-[#ffd43b] hover:bg-[#facc15] text-[#050505] border-2 border-black rounded-xl shadow-[3px_3px_0_#000000] font-display font-black text-xs sm:text-sm tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center gap-2"
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>CONTINUE PRACTICE</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => navigate('/contests')}
                className="px-5 py-2.5 bg-[#38aef0] hover:bg-[#209be2] text-[#050505] border-2 border-black rounded-xl shadow-[2.5px_2.5px_0_#000000] font-display font-black text-xs tracking-wider uppercase transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center gap-2"
              >
                <Trophy className="w-3.5 h-3.5 shrink-0" />
                <span>EXPLORE CONTESTS</span>
              </button>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* COMPACT METRIC DECK (4 CONTRAST CARDS)            */}
        {/* ================================================= */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* Card 1: Contests Played */}
          <div className="bg-white border-2 border-black rounded-xl p-3 sm:p-4 shadow-[3px_3px_0_#000000]">
            <div className="flex items-center justify-between text-black/60 font-mono text-[9px] sm:text-[10px] font-black uppercase">
              <span>CONTESTS</span>
              <Trophy className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="font-display font-black text-2xl sm:text-3xl text-black leading-none mt-1">
              0
            </div>
            <div className="text-[10px] font-bold text-black/60 mt-1 truncate">
              0 podium finishes
            </div>
          </div>

          {/* Card 2: Total XP / Score */}
          <div className="bg-[#ffd43b] border-2 border-black rounded-xl p-3 sm:p-4 shadow-[3px_3px_0_#000000]">
            <div className="flex items-center justify-between text-black/80 font-mono text-[9px] sm:text-[10px] font-black uppercase">
              <span>TOTAL SCORE</span>
              <Zap className="w-3.5 h-3.5 fill-black text-black" />
            </div>
            <div className="font-display font-black text-2xl sm:text-3xl text-black leading-none mt-1">
              {totalPoints} <span className="text-xs sm:text-sm font-bold">XP</span>
            </div>
            <div className="text-[10px] font-bold text-black/75 mt-1 truncate">
              {solvedCount} questions solved
            </div>
          </div>

          {/* Card 3: Current Rank */}
          <div className="bg-[#38aef0] border-2 border-black rounded-xl p-3 sm:p-4 shadow-[3px_3px_0_#000000]">
            <div className="flex items-center justify-between text-black/80 font-mono text-[9px] sm:text-[10px] font-black uppercase">
              <span>ARENA RANK</span>
              <Target className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="font-display font-black text-2xl sm:text-3xl text-black leading-none mt-1">
              #127
            </div>
            <div className="text-[10px] font-bold text-black/75 mt-1 truncate">
              Top 12% in Division 1
            </div>
          </div>

          {/* Card 4: Accuracy */}
          <div className="bg-[#32e875] border-2 border-black rounded-xl p-3 sm:p-4 shadow-[3px_3px_0_#000000]">
            <div className="flex items-center justify-between text-black/80 font-mono text-[9px] sm:text-[10px] font-black uppercase">
              <span>ACCURACY</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="font-display font-black text-2xl sm:text-3xl text-black leading-none mt-1">
              {accuracyRate}%
            </div>
            <div className="text-[10px] font-bold text-black/75 mt-1 truncate">
              Based on recent attempts
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* ARENA CORE: QUESTION BANK & DAILY CHALLENGE       */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 sm:gap-5">
          {/* Question Bank Practice Module */}
          <section className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-[5px_5px_0_#ffd43b] flex flex-col justify-between overflow-hidden">
            <div>
              <div className="p-3.5 sm:p-4 border-b-2 border-black flex items-center justify-between gap-3 bg-[#faf9f6]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-[#ffd43b] border-2 border-black rounded-lg flex items-center justify-center font-display font-black text-xs shadow-[1.5px_1.5px_0_#000000]">
                    Q
                  </div>
                  <div>
                    <h2 className="font-display font-black text-base uppercase text-black leading-none">
                      QUESTION BANK
                    </h2>
                    <span className="font-mono text-[9px] font-bold text-black/60 uppercase">
                      SPEED PRACTICE ARENA
                    </span>
                  </div>
                </div>

                <Link
                  to="/questions"
                  className="px-3 py-1 bg-[#32e875] hover:bg-[#22c55e] border-2 border-black rounded-lg font-display font-black text-[11px] uppercase shadow-[1.5px_1.5px_0_#000000] flex items-center gap-1 transition-transform hover:-translate-x-0.5"
                >
                  <span>ALL PROBLEMS</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {/* Progress Summary Blocks */}
              <div className="p-3.5 sm:p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-[#fffde7] border-2 border-black rounded-xl shadow-[2px_2px_0_#000000]">
                    <div className="font-display font-black text-xl text-black">
                      {solvedCount} / {totalQuestions}
                    </div>
                    <div className="font-display font-black text-[10px] uppercase text-black mt-0.5">
                      PROBLEMS COMPLETED
                    </div>
                    <div className="w-full h-2 bg-white border-1.5 border-black rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-[#ffd43b] rounded-full"
                        style={{
                          width: `${(solvedCount / Math.max(totalQuestions, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-[#e9f6ff] border-2 border-black rounded-xl shadow-[2px_2px_0_#000000]">
                    <div className="font-display font-black text-xl text-[#071a2b]">
                      {accuracyRate}%
                    </div>
                    <div className="font-display font-black text-[10px] uppercase text-black mt-0.5">
                      SOLVER ACCURACY
                    </div>
                    <div className="w-full h-2 bg-white border-1.5 border-black rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-[#38aef0] rounded-full"
                        style={{ width: `${accuracyRate}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Topics strip */}
                <div className="p-3 bg-[#f8fafc] border-2 border-black rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="font-display font-black text-xs uppercase text-black">
                      CORE PRACTICE DOMAINS
                    </div>
                    <div className="text-[11px] font-body font-bold text-black/60 mt-0.5">
                      Quantitative • Logical • Data Interpretation
                    </div>
                  </div>

                  <Link
                    to="/questions"
                    className="px-3 py-1.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-black rounded-lg font-display font-black text-xs uppercase shadow-[1.5px_1.5px_0_#000000] text-center shrink-0 transition-transform hover:-translate-x-0.5"
                  >
                    START SOLVING →
                  </Link>
                </div>
              </div>
            </div>

            <div className="px-4 py-2.5 border-t-2 border-black bg-white flex items-center justify-between text-xs font-mono font-bold text-black/70">
              <span>{totalQuestions - solvedCount} problems remaining</span>
              <span
                className="text-[#2563eb] font-black underline cursor-pointer"
                onClick={() => navigate('/questions')}
              >
                Open Practice Arena
              </span>
            </div>
          </section>

          {/* Daily Challenge Card */}
          <section className="bg-[#ffd43b] border-2 sm:border-3 border-black rounded-2xl shadow-[5px_5px_0_#000000] flex flex-col justify-between p-4 sm:p-5 overflow-hidden">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b-2 border-black">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 fill-black text-black" />
                  <span className="font-display font-black text-xs uppercase">
                    DAILY CHALLENGE
                  </span>
                </div>
                <div className="bg-[#ff5b5b] text-white border-1.5 border-black rounded-full px-2 py-0.5 font-mono text-[9px] font-black uppercase shadow-[1px_1px_0_#000000]">
                  +50 BONUS XP
                </div>
              </div>

              <div className="mt-3 bg-white border-2 border-black rounded-xl p-3.5 sm:p-4 shadow-[2.5px_2.5px_0_#000000]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="bg-[#38aef0] border-1.5 border-black rounded-full px-2 py-0.5 text-[9px] font-display font-black uppercase">
                    MEDIUM • 120 SEC
                  </span>
                  <div className="flex items-center gap-1 font-mono text-[11px] font-black text-black">
                    <Clock className="w-3 h-3" />
                    <span>23h 14m left</span>
                  </div>
                </div>

                <h3 className="font-display font-black text-base uppercase text-black leading-tight mt-1.5">
                  PROBABILITY & COMBINATIONS SPRINT
                </h3>

                <p className="mt-1 text-xs font-body font-semibold text-black/70 leading-relaxed">
                  Solve today's speed challenge in under 2 minutes to keep your streak alive.
                </p>

                <button
                  type="button"
                  onClick={() => navigate('/questions/quant-001')}
                  className="mt-3 w-full py-2.5 bg-[#32e875] hover:bg-[#22c55e] border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[2.5px_2.5px_0_#000000] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5 fill-black" />
                  <span>ACCEPT DAILY CHALLENGE →</span>
                </button>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t-2 border-black/20 flex items-center justify-between text-[10px] font-mono font-black text-black/80">
              <span>CURRENT STREAK: 1 DAY</span>
              <span>BEST: 7 DAYS</span>
            </div>
          </section>
        </div>

        {/* ================================================= */}
        {/* LOWER DECK: UPCOMING CONTESTS & ARENA SHORTCUTS   */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 sm:gap-5">
          {/* Upcoming Contests */}
          <section className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-[5px_5px_0_#38aef0] overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b-2 border-black flex items-center justify-between gap-3 bg-[#faf9f6]">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-black" />
                <div>
                  <h2 className="font-display font-black text-base uppercase text-black leading-none">
                    UPCOMING CONTESTS
                  </h2>
                  <span className="font-mono text-[9px] font-bold text-black/60 uppercase">
                    COMPETITIVE ARENA SCHEDULE (SEASON 01 PREVIEW)
                  </span>
                </div>
              </div>

              <Link
                to="/contests"
                className="px-3 py-1 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-black rounded-lg font-display font-black text-[11px] uppercase shadow-[1.5px_1.5px_0_#000000] flex items-center gap-1 transition-transform hover:-translate-x-0.5"
              >
                <span>VIEW ALL</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="p-3.5 sm:p-4 space-y-2.5">
              {/* Contest 1 */}
              <div className="p-3 bg-white border-2 border-black rounded-xl shadow-[2.5px_2.5px_0_#000000] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#f8fafc] transition-colors">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="bg-[#ff5b5b] text-white border border-black rounded-full px-2 py-0.2 text-[8px] font-display font-black uppercase">
                      PREVIEW ROUND
                    </span>
                    <span className="text-[11px] font-mono font-bold text-black/60">
                      30 MINS • 15 QUESTIONS
                    </span>
                  </div>
                  <h4 className="font-display font-black text-sm uppercase text-black">
                    APTICKS SPEED CLASH #14
                  </h4>
                  <p className="text-[11px] font-body font-semibold text-black/60 mt-0.5">
                    Quantitative & Speed Arithmetic • Open Division
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/contests')}
                  className="px-3 py-1.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-black rounded-lg font-display font-black text-xs uppercase shadow-[1.5px_1.5px_0_#000000] shrink-0 transition-transform hover:-translate-x-0.5"
                >
                  VIEW FIXTURE →
                </button>
              </div>

              {/* Contest 2 */}
              <div className="p-3 bg-white border-2 border-black rounded-xl shadow-[2.5px_2.5px_0_#000000] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#f8fafc] transition-colors">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="bg-[#38aef0] text-black border border-black rounded-full px-2 py-0.2 text-[8px] font-display font-black uppercase">
                      SATURDAY 8 PM
                    </span>
                    <span className="text-[11px] font-mono font-bold text-black/60">
                      45 MINS • 25 QUESTIONS
                    </span>
                  </div>
                  <h4 className="font-display font-black text-sm uppercase text-black">
                    WEEKEND GRAND PRIX: LOGICAL DOMINANCE
                  </h4>
                  <p className="text-[11px] font-body font-semibold text-black/60 mt-0.5">
                    Puzzles, Seating & Logic • Master Division
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/contests')}
                  className="px-3 py-1.5 bg-white hover:bg-[#e9f6ff] border-2 border-black rounded-lg font-display font-black text-xs uppercase shadow-[1.5px_1.5px_0_#000000] shrink-0 transition-transform hover:-translate-x-0.5"
                >
                  VIEW FIXTURE →
                </button>
              </div>
            </div>
          </section>

          {/* Quick Hub Navigation Actions */}
          <section className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-[5px_5px_0_#000000] p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="pb-2.5 border-b-2 border-black flex items-center justify-between">
                <span className="font-display font-black text-xs uppercase">
                  QUICK NAVIGATION
                </span>
                <Sparkles className="w-3.5 h-3.5 text-[#ffd43b]" />
              </div>

              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => navigate('/questions')}
                  className="w-full p-2.5 bg-[#fffde7] hover:bg-[#fff9c4] border-2 border-black rounded-xl shadow-[2px_2px_0_#000000] font-display font-black text-xs uppercase text-left flex items-center justify-between transition-transform hover:-translate-x-0.5 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-black" />
                    PRACTICE QUESTION BANK
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-black" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/leaderboard')}
                  className="w-full p-2.5 bg-[#e9f6ff] hover:bg-[#d0ebff] border-2 border-black rounded-xl shadow-[2px_2px_0_#000000] font-display font-black text-xs uppercase text-left flex items-center justify-between transition-transform hover:-translate-x-0.5 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5 text-black" />
                    GLOBAL LEADERBOARD PREVIEW
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-black" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="w-full p-2.5 bg-[#d1fae5] hover:bg-[#a7f3d0] border-2 border-black rounded-xl shadow-[2px_2px_0_#000000] font-display font-black text-xs uppercase text-left flex items-center justify-between transition-transform hover:-translate-x-0.5 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-black" />
                    ATHLETE PROFILE & SETTINGS
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-black" />
                </button>
              </div>
            </div>

            {/* Motivational motto */}
            <div className="mt-4 pt-2.5 border-t-2 border-black/10 text-center font-mono text-[9px] font-black text-black/50 tracking-widest uppercase">
              APTICKS • THINK FAST • SOLVE ACCURATE
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  )
}