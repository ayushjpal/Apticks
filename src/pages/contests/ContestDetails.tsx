import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Trophy,
  Users,
  Clock,
  Calendar,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Flame,
  Zap,
  BookOpen,
  Award,
  Loader2,
  HelpCircle,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { ContestService } from '../../services/contestService'
import type { Contest, UserContestStatus } from '../../types/contests'
import { supabase } from '../../lib/supabase'

export default function ContestDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [contest, setContest] = useState<Contest | null>(null)
  const [userStatus, setUserStatus] = useState<UserContestStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadContestData = async () => {
      if (!id) return
      setLoading(true)
      try {
        const [c, status] = await Promise.all([
          ContestService.getContestById(id),
          ContestService.getUserContestStatus(id),
        ])

        if (isMounted) {
          setContest(c)
          setUserStatus(status)
        }
      } catch (err) {
        console.error('Error loading contest details:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadContestData()

    return () => {
      isMounted = false
    }
  }, [id])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleRegister = async () => {
    if (!contest) return
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      navigate('/login', { state: { from: `/contests/${contest.id}` } })
      return
    }

    setIsRegistering(true)
    try {
      const res = await ContestService.registerForContest(contest.id)
      if (res.success) {
        setUserStatus((prev) => ({
          ...prev,
          found: true,
          isAuthenticated: true,
          isRegistered: true,
          status: 'registered',
        }))
        setContest((prev) =>
          prev
            ? {
                ...prev,
                isRegistered: true,
                participantsCount: (prev.participantsCount || 0) + (res.alreadyRegistered ? 0 : 1),
              }
            : null
        )
        showToast(res.message || 'Successfully registered!')
      } else {
        showToast(res.message || 'Registration failed.')
      }
    } catch (err) {
      console.error('Registration failed:', err)
      showToast('Registration failed.')
    } finally {
      setIsRegistering(false)
    }
  }

  const handleEnterArena = async () => {
    if (!contest) return
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      navigate('/login', { state: { from: `/contests/${contest.id}/arena` } })
      return
    }

    // Auto-register if entering live contest directly
    if (!userStatus?.isRegistered) {
      setIsRegistering(true)
      const res = await ContestService.registerForContest(contest.id)
      setIsRegistering(false)
      if (!res.success && !res.alreadyRegistered) {
        showToast(res.message || 'Failed to register.')
        return
      }
    }

    navigate(`/contests/${contest.id}/arena`)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center font-display font-black">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-black/40 mb-3" />
            <p className="text-xs tracking-wider uppercase text-black/70">
              LOADING CONTEST ARENA DETAILS...
            </p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!contest) {
    return (
      <AppLayout>
        <div className="p-8 bg-white border-3 border-black rounded-2xl shadow-[6px_6px_0_#000000] text-center max-w-lg mx-auto mt-12">
          <Trophy className="w-12 h-12 mx-auto text-black/30 mb-3" />
          <h2 className="font-display font-black text-xl uppercase text-black">
            CONTEST NOT FOUND
          </h2>
          <p className="text-xs font-body font-semibold text-black/60 mt-1">
            The requested tournament fixture does not exist or has been removed.
          </p>
          <Link
            to="/contests"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>RETURN TO CONTESTS</span>
          </Link>
        </div>
      </AppLayout>
    )
  }

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const isCompletedByPlayer = userStatus?.status === 'completed'
  const isContestCompleted = contest.status === 'completed'
  const isLive = contest.status === 'live'

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 animate-entry max-w-5xl mx-auto pb-12">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#ffd43b] text-black border-3 border-black p-3.5 rounded-xl shadow-[4px_4px_0_#000000] font-display font-black text-xs uppercase flex items-center gap-2 animate-bounce">
            <Zap className="w-4 h-4 fill-black" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Back Link */}
        <div>
          <button
            type="button"
            onClick={() => navigate('/contests')}
            className="inline-flex items-center gap-1.5 font-display font-black text-xs uppercase text-black hover:text-[#38aef0] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO ALL TOURNAMENTS</span>
          </button>
        </div>

        {/* ================================================= */}
        {/* HERO SPEC CARD                                    */}
        {/* ================================================= */}
        <section className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] p-5 sm:p-7 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {isLive && (
                  <span className="bg-[#ff5b5b] text-white border-2 border-black rounded-full px-3 py-0.5 font-display font-black text-[10px] uppercase flex items-center gap-1 animate-pulse">
                    <Flame className="w-3.5 h-3.5 fill-white" />
                    LIVE TOURNAMENT ROUND
                  </span>
                )}
                {contest.status === 'upcoming' && (
                  <span className="bg-[#38aef0] text-black border-2 border-black rounded-full px-3 py-0.5 font-display font-black text-[10px] uppercase">
                    UPCOMING FIXTURE
                  </span>
                )}
                {contest.status === 'completed' && (
                  <span className="bg-slate-200 text-black border-2 border-black rounded-full px-3 py-0.5 font-display font-black text-[10px] uppercase">
                    ARCHIVED TOURNAMENT
                  </span>
                )}

                <span className="bg-[#ffd43b] text-black border-2 border-black rounded-full px-2.5 py-0.5 font-mono font-black text-[10px] uppercase">
                  DIVISION: {contest.difficulty.toUpperCase()}
                </span>

                <span className="bg-[#f8fafc] border border-black rounded-full px-2.5 py-0.5 font-mono font-bold text-[10px] text-black/70">
                  {contest.category}
                </span>
              </div>

              <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl uppercase text-black leading-tight">
                {contest.title}
              </h1>

              <p className="text-xs sm:text-sm font-body font-semibold text-black/75 leading-relaxed">
                {contest.description ||
                  'Synchronous speed assessment under competitive negative marking rules. Beat the clock and climb the global division standing.'}
              </p>

              {/* Solvers & Prize strip */}
              <div className="flex flex-wrap items-center gap-3 pt-2 font-mono text-xs font-black">
                <span className="bg-white border-2 border-black rounded-xl px-3 py-1 flex items-center gap-1.5 shadow-[1.5px_1.5px_0_#000000]">
                  <Users className="w-3.5 h-3.5" />
                  <span>{contest.participantsCount || 0} REGISTERED ATHLETES</span>
                </span>
                <span className="bg-black text-[#ffd43b] border-2 border-black rounded-xl px-3 py-1 flex items-center gap-1.5 shadow-[1.5px_1.5px_0_#000000]">
                  <Zap className="w-3.5 h-3.5 fill-[#ffd43b]" />
                  <span>{contest.xpPool} XP PRIZE POOL</span>
                </span>
              </div>
            </div>

            {/* Primary Dynamic Action Box */}
            <div className="w-full lg:w-72 shrink-0 bg-[#faf9f6] border-2 border-black rounded-xl p-4 shadow-[3px_3px_0_#000000] flex flex-col justify-between space-y-3">
              <div>
                <div className="text-[10px] font-mono font-bold text-black/60 uppercase">
                  YOUR STATUS
                </div>
                <div className="mt-0.5 font-display font-black text-sm uppercase text-black flex items-center gap-1.5">
                  {isCompletedByPlayer ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                      <span>COMPLETED ({userStatus?.totalScore} PTS)</span>
                    </>
                  ) : userStatus?.isRegistered ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#38aef0]" />
                      <span>REGISTERED [✓]</span>
                    </>
                  ) : (
                    <span>NOT REGISTERED</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div>
                {isCompletedByPlayer || isContestCompleted ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/contests/${contest.id}/results`)}
                    className="w-full py-3 bg-[#ffd43b] hover:bg-[#facc15] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Award className="w-4 h-4" />
                    <span>VIEW RESULTS & STANDINGS</span>
                  </button>
                ) : isLive ? (
                  <button
                    type="button"
                    onClick={handleEnterArena}
                    disabled={isRegistering}
                    className="w-full py-3 bg-[#ff5b5b] hover:bg-[#ef4444] text-white border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center justify-center gap-1.5 cursor-pointer transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
                  >
                    {isRegistering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Flame className="w-4 h-4 fill-white" />
                        <span>ENTER LIVE ARENA →</span>
                      </>
                    )}
                  </button>
                ) : contest.status === 'upcoming' ? (
                  userStatus?.isRegistered ? (
                    <div className="w-full py-2.5 bg-[#32e875] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>REGISTERED — READY</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isRegistering}
                      onClick={handleRegister}
                      className="w-full py-3 bg-[#38aef0] hover:bg-[#209be2] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center justify-center gap-1.5 cursor-pointer transition-transform hover:-translate-x-0.5"
                    >
                      {isRegistering ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Calendar className="w-4 h-4" />
                          <span>REGISTER FOR CLASH</span>
                        </>
                      )}
                    </button>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* SPECIFICATION GRID METRICS (4 TILES)              */}
        {/* ================================================= */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0_#000000]">
            <div className="flex items-center justify-between text-black/60 font-mono text-[10px] font-black uppercase">
              <span>SCHEDULE</span>
              <Clock className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="font-display font-black text-sm sm:text-base text-black mt-1 truncate">
              {formatDateTime(contest.startTime)}
            </div>
            <div className="text-[10px] font-bold text-black/60 mt-0.5">
              Ends {formatDateTime(contest.endTime)}
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0_#000000]">
            <div className="flex items-center justify-between text-black/60 font-mono text-[10px] font-black uppercase">
              <span>ARENA TIME</span>
              <Clock className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="font-display font-black text-lg sm:text-xl text-black mt-1">
              {contest.durationMinutes} MINS
            </div>
            <div className="text-[10px] font-bold text-black/60 mt-0.5">
              Server-authoritative timer
            </div>
          </div>

          <div className="bg-white border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0_#000000]">
            <div className="flex items-center justify-between text-black/60 font-mono text-[10px] font-black uppercase">
              <span>VOLUME</span>
              <BookOpen className="w-3.5 h-3.5 text-black" />
            </div>
            <div className="font-display font-black text-lg sm:text-xl text-black mt-1">
              {contest.totalQuestions} QUESTIONS
            </div>
            <div className="text-[10px] font-bold text-black/60 mt-0.5">
              {contest.totalMarks} Total marks
            </div>
          </div>

          <div className="bg-[#ffd43b] border-2 border-black rounded-xl p-3.5 shadow-[3px_3px_0_#000000]">
            <div className="flex items-center justify-between text-black/80 font-mono text-[10px] font-black uppercase">
              <span>MARKING RULE</span>
              <Zap className="w-3.5 h-3.5 fill-black text-black" />
            </div>
            <div className="font-display font-black text-lg sm:text-xl text-black mt-1">
              +{contest.positiveMarksPerQuestion} / -{contest.negativeMarksPerQuestion}
            </div>
            <div className="text-[10px] font-bold text-black/70 mt-0.5">
              Penalty per wrong answer
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* RULES & SYLLABUS SECTION                          */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Contest Rules */}
          <section className="bg-white border-3 border-black rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0_#000000] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b-2 border-black">
                <HelpCircle className="w-4 h-4 text-black" />
                <h3 className="font-display font-black text-base uppercase text-black">
                  TOURNAMENT RULES
                </h3>
              </div>

              <div className="mt-4 space-y-2.5 text-xs font-body font-semibold text-black/80 leading-relaxed">
                <p>
                  1. <strong className="text-black">Strict Server Clock:</strong> The contest timer runs on the Supabase database clock. Once the countdown expires, submissions are locked.
                </p>
                <p>
                  2. <strong className="text-black">Negative Deductions:</strong> Each correct response awards <span className="font-bold text-[#15803d]">+{contest.positiveMarksPerQuestion} marks</span>. An incorrect response incurs a deduction of <span className="font-bold text-[#b91c1c]">-{contest.negativeMarksPerQuestion} marks</span>. Unattempted questions carry zero penalty.
                </p>
                <p>
                  3. <strong className="text-black">Tie-Breaking Protocol:</strong> Solvers with equal scores are ranked strictly by total time taken (in seconds) to finish.
                </p>
                <p>
                  4. <strong className="text-black">Solution Integrity:</strong> Official explanations and answer reviews unlock immediately upon submission completion.
                </p>
              </div>
            </div>

            {contest.rules && (
              <div className="mt-4 pt-3 border-t-2 border-black/10 font-mono text-[11px] text-black/70">
                {contest.rules}
              </div>
            )}
          </section>

          {/* Syllabus */}
          <section className="bg-white border-3 border-black rounded-2xl p-5 sm:p-6 shadow-[5px_5px_0_#000000] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b-2 border-black">
                <BookOpen className="w-4 h-4 text-black" />
                <h3 className="font-display font-black text-base uppercase text-black">
                  ARENA SYLLABUS & DOMAINS
                </h3>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="font-mono text-[10px] font-bold text-black/60 uppercase">
                    PRIMARY TOPIC FOCUS
                  </div>
                  <div className="mt-1 font-display font-black text-sm uppercase text-black">
                    {contest.category}
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[10px] font-bold text-black/60 uppercase">
                    TESTED CURRICULUM
                  </div>
                  <p className="mt-1 text-xs font-body font-semibold text-black/80 leading-relaxed">
                    {contest.syllabus ||
                      'Quantitative arithmetic, algebraic relations, fast computational speed, and multi-variable logical setups.'}
                  </p>
                </div>

                <div className="p-3 bg-[#f8fafc] border-2 border-black rounded-xl">
                  <div className="font-mono text-[10px] font-black text-black uppercase">
                    SPEED RECOMMENDATION
                  </div>
                  <div className="text-[11px] font-body font-semibold text-black/70 mt-0.5">
                    Target pace: ~{(contest.durationMinutes / Math.max(contest.totalQuestions, 1)).toFixed(1)} minutes per problem to ensure a complete buffer for review.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t-2 border-black flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold text-black/60">
                DIVISION: {contest.difficulty.toUpperCase()}
              </span>
              <button
                type="button"
                onClick={() => navigate('/leaderboard')}
                className="font-display font-black text-xs uppercase text-[#2563eb] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>GLOBAL RANKINGS</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  )
}
