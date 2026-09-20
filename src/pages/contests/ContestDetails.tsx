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
import { StatusBadge, NeoBadge } from '../../components/ui'
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-2" />
          <p className="text-xs font-mono text-slate-500">
            Loading tournament details...
          </p>
        </div>
      </div>
    )
  }

  if (!contest) {
    return (
      <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-sm text-center max-w-md mx-auto mt-12">
        <Trophy className="w-10 h-10 mx-auto text-slate-300 mb-3" />
        <h2 className="font-bold text-lg text-slate-900">
          Tournament Not Found
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          The requested tournament fixture does not exist or has been removed.
        </p>
        <Link
          to="/contests"
          className="inline-flex items-center gap-2 mt-5 px-4 py-2 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-lg font-bold text-xs shadow-xs transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Tournaments</span>
        </Link>
      </div>
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
    <div className="max-w-[1160px] mx-auto space-y-4 sm:space-y-6 animate-entry pb-12">
      <div className="space-y-4 sm:space-y-6 animate-entry pb-12">
        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#ffd43b] text-[#0c1d2d] border-2 border-[#0c1d2d] p-3.5 rounded-xl shadow-[3px_3px_0_#0c1d2d] font-display font-black text-xs uppercase flex items-center gap-2 animate-bounce">
            <Zap className="w-4 h-4 fill-[#0c1d2d]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Back Link */}
        <div>
          <button
            type="button"
            onClick={() => navigate('/contests')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Back to All Tournaments</span>
          </button>
        </div>

        {/* ================================================= */}
        {/* HERO SPEC CARD                                    */}
        {/* ================================================= */}
        <section className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-sm p-6 sm:p-7 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={contest.status} density="xs" />
                <StatusBadge status={contest.difficulty} density="xs" />
                <NeoBadge variant="outline" density="xs">
                  {contest.category}
                </NeoBadge>
              </div>

              <h1 className="font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight leading-tight">
                {contest.title}
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {contest.description ||
                  'Synchronous speed assessment under competitive negative marking rules. Beat the clock and climb the global division standing.'}
              </p>

              {/* Solvers & Prize strip */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1.5 font-mono text-xs">
                <span className="bg-slate-50 border border-slate-200/80 rounded-md px-2.5 py-1 flex items-center gap-1.5 text-slate-700">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>{contest.participantsCount || 0} Registered Competitors</span>
                </span>
                <span className="bg-amber-50 text-amber-900 border border-amber-200/70 rounded-md px-2.5 py-1 flex items-center gap-1.5 font-bold">
                  <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{contest.xpPool} XP Prize Pool</span>
                </span>
              </div>
            </div>

            {/* Primary Dynamic Action Box */}
            <div className="w-full lg:w-72 shrink-0 bg-slate-50 border border-slate-200/80 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3">
              <div>
                <div className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                  Your Status
                </div>
                <div className="mt-1 font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  {isCompletedByPlayer ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Completed ({userStatus?.totalScore} pts)</span>
                    </>
                  ) : userStatus?.isRegistered ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-sky-600" />
                      <span>Registered for Event</span>
                    </>
                  ) : (
                    <span className="text-slate-500 font-normal">Not Registered</span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div>
                {isCompletedByPlayer || isContestCompleted ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/contests/${contest.id}/results`)}
                    className="w-full py-2.5 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-lg font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Award className="w-4 h-4 text-[#0c1d2d]" />
                    <span>View Standings & Solutions</span>
                  </button>
                ) : isLive ? (
                  <button
                    type="button"
                    onClick={handleEnterArena}
                    disabled={isRegistering}
                    className="w-full py-2.5 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-lg font-bold text-xs uppercase tracking-wide shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.99]"
                  >
                    {isRegistering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Flame className="w-4 h-4 text-[#0c1d2d]" />
                        <span>Enter Live Arena</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#0c1d2d]" />
                      </>
                    )}
                  </button>
                ) : contest.status === 'upcoming' ? (
                  userStatus?.isRegistered ? (
                    <div className="w-full py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-xs text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Registered — Ready</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isRegistering}
                      onClick={handleRegister}
                      className="w-full py-2.5 bg-[#0c1d2d] hover:bg-[#15324d] text-white border border-[#0c1d2d] rounded-lg font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      {isRegistering ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Register for Clash</span>
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
          <div className="bg-white border border-[#0c1d2d]/10 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 font-mono text-[10px] font-semibold uppercase tracking-wider">
              <span>Schedule</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="font-bold text-sm sm:text-base text-slate-900 mt-1 truncate">
              {formatDateTime(contest.startTime)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Ends {formatDateTime(contest.endTime)}
            </div>
          </div>

          <div className="bg-white border border-[#0c1d2d]/10 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 font-mono text-[10px] font-semibold uppercase tracking-wider">
              <span>Arena Time</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="font-bold text-lg sm:text-xl text-slate-900 mt-1">
              {contest.durationMinutes} Mins
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Server-authoritative timer
            </div>
          </div>

          <div className="bg-white border border-[#0c1d2d]/10 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 font-mono text-[10px] font-semibold uppercase tracking-wider">
              <span>Volume</span>
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="font-bold text-lg sm:text-xl text-slate-900 mt-1">
              {contest.totalQuestions} Questions
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {contest.totalMarks} Total marks
            </div>
          </div>

          <div className="bg-white border border-amber-200/80 rounded-xl p-4 shadow-xs bg-gradient-to-b from-amber-50/40 to-white">
            <div className="flex items-center justify-between text-amber-900/80 font-mono text-[10px] font-bold uppercase tracking-wider">
              <span>Marking Rule</span>
              <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
            </div>
            <div className="font-bold text-lg sm:text-xl text-slate-900 mt-1">
              +{contest.positiveMarksPerQuestion} / -{contest.negativeMarksPerQuestion}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Penalty per wrong answer
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* RULES & SYLLABUS SECTION                          */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Contest Rules */}
          <section className="bg-white border border-[#0c1d2d]/12 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <HelpCircle className="w-4 h-4 text-slate-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Tournament Regulations
                </h3>
              </div>

              <div className="mt-3.5 space-y-2 text-xs text-slate-700 leading-relaxed font-normal">
                <p>
                  1. <strong className="text-slate-900 font-semibold">Strict Server Clock:</strong> The contest timer runs on the Supabase database clock. Once the countdown expires, submissions are locked.
                </p>
                <p>
                  2. <strong className="text-slate-900 font-semibold">Negative Deductions:</strong> Each correct response awards <span className="font-semibold text-emerald-700">+{contest.positiveMarksPerQuestion} marks</span>. An incorrect response incurs a deduction of <span className="font-semibold text-rose-700">-{contest.negativeMarksPerQuestion} marks</span>. Unattempted questions carry zero penalty.
                </p>
                <p>
                  3. <strong className="text-slate-900 font-semibold">Tie-Breaking Protocol:</strong> Solvers with equal scores are ranked strictly by total time taken (in seconds) to finish.
                </p>
                <p>
                  4. <strong className="text-slate-900 font-semibold">Solution Integrity:</strong> Official explanations and answer reviews unlock immediately upon submission completion.
                </p>
              </div>
            </div>

            {contest.rules && (
              <div className="mt-4 pt-3 border-t border-slate-100 font-mono text-[11px] text-slate-500">
                {contest.rules}
              </div>
            )}
          </section>

          {/* Syllabus */}
          <section className="bg-white border border-[#0c1d2d]/12 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <BookOpen className="w-4 h-4 text-slate-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Curriculum & Domains
                </h3>
              </div>

              <div className="mt-3.5 space-y-3">
                <div>
                  <div className="font-mono text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Primary Topic Focus
                  </div>
                  <div className="mt-0.5 font-bold text-sm text-slate-900">
                    {contest.category}
                  </div>
                </div>

                <div>
                  <div className="font-mono text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Tested Curriculum
                  </div>
                  <p className="mt-0.5 text-xs text-slate-700 leading-relaxed">
                    {contest.syllabus ||
                      'Quantitative arithmetic, algebraic relations, fast computational speed, and multi-variable logical setups.'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-lg">
                  <div className="font-mono text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Speed Recommendation
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Target pace: ~{(contest.durationMinutes / Math.max(contest.totalQuestions, 1)).toFixed(1)} minutes per problem to ensure a complete buffer for review.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="font-mono text-[11px] text-slate-500">
                Division: <span className="font-semibold text-slate-800 uppercase">{contest.difficulty}</span>
              </span>
              <button
                type="button"
                onClick={() => navigate('/leaderboard')}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Global Rankings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
