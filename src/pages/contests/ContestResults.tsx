import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Trophy,
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Zap,
  BookOpen,
  Users,
  Loader2,
  Flame,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { ContestService } from '../../services/contestService'
import type {
  Contest,
  ContestLeaderboardEntry,
  ContestReviewQuestion,
  UserContestStatus,
} from '../../types/contests'

export default function ContestResults() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [contest, setContest] = useState<Contest | null>(null)
  const [userStatus, setUserStatus] = useState<UserContestStatus | null>(null)
  const [leaderboard, setLeaderboard] = useState<ContestLeaderboardEntry[]>([])
  const [reviewQuestions, setReviewQuestions] = useState<ContestReviewQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'review' | 'leaderboard'>('overview')
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadResults = async () => {
      if (!id) return
      setLoading(true)

      try {
        const [c, status, leaders, reviewRes] = await Promise.all([
          ContestService.getContestById(id),
          ContestService.getUserContestStatus(id),
          ContestService.getContestLeaderboard(id),
          ContestService.getContestReview(id),
        ])

        if (isMounted) {
          setContest(c)
          setUserStatus(status)
          setLeaderboard(leaders)
          if (reviewRes.success) {
            setReviewQuestions(reviewRes.questions)
            if (reviewRes.questions.length > 0) {
              setExpandedQuestionId(reviewRes.questions[0].questionId)
            }
          }
        }
      } catch (err) {
        console.error('Error loading contest results:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadResults()

    return () => {
      isMounted = false
    }
  }, [id])

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400 mb-2" />
            <p className="text-xs font-mono text-slate-500">
              Calculating tournament results & standings...
            </p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!contest) {
    return (
      <AppLayout>
        <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-sm text-center max-w-md mx-auto mt-12">
          <Trophy className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <h2 className="font-bold text-lg text-slate-900">
            Tournament Not Found
          </h2>
          <Link
            to="/contests"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-lg font-bold text-xs shadow-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Tournaments</span>
          </Link>
        </div>
      </AppLayout>
    )
  }

  const formatSeconds = (sec: number | null | undefined) => {
    if (!sec) return '0s'
    const m = Math.floor(sec / 60)
    const s = sec % 60
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const isUserCompleted = userStatus?.status === 'completed'
  const userRank = userStatus?.rank || null
  const userScore = userStatus?.totalScore ?? 0
  const userAccuracy = userStatus?.accuracyPercentage ?? 0
  const userTime = userStatus?.timeTakenSeconds ?? 0
  const userXp = userStatus?.xpAwarded ?? 0
  const correctCount = userStatus?.correctAnswersCount ?? 0
  const wrongCount = userStatus?.wrongAnswersCount ?? 0
  const unattemptedCount = userStatus?.unattemptedCount ?? 0

  return (
    <AppLayout maxWidth="narrow">
      <div className="space-y-4 sm:space-y-6 animate-entry pb-12">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/contests')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>All Tournaments</span>
          </button>

          <span className="font-mono text-xs font-medium text-slate-400 uppercase">
            Tournament Report
          </span>
        </div>

        {/* ================================================= */}
        {/* HERO RESULTS CARD                                 */}
        {/* ================================================= */}
        <section className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-sm p-6 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="bg-slate-100 text-slate-700 border border-slate-200 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold">
                  {contest.category}
                </span>
                <span className="bg-[#0c1d2d] text-white rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-[#ffd43b]" />
                  <span>Arena Report</span>
                </span>
              </div>

              <h1 className="font-bold text-2xl sm:text-3xl text-slate-900 leading-tight">
                {contest.title}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 font-normal">
                Official tournament conclusion, verified server grading, and competitor standings.
              </p>
            </div>

            {/* Quick action: Re-enter arena if live and not submitted, or view standings */}
            {contest.status === 'live' && !isUserCompleted && (
              <button
                type="button"
                onClick={() => navigate(`/contests/${contest.id}/arena`)}
                className="px-4 py-2.5 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-lg font-bold text-xs uppercase tracking-wide shadow-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5 text-[#0c1d2d]" />
                <span>Resume Arena Session</span>
              </button>
            )}
          </div>
        </section>

        {/* ================================================= */}
        {/* ATHLETE PERFORMANCE STATS (IF USER COMPLETED)     */}
        {/* ================================================= */}
        {isUserCompleted && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Award className="w-4 h-4 text-amber-600" />
              <span>Your Verified Performance</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Score */}
              <div className="bg-white border border-[#0c1d2d]/10 rounded-xl p-4 shadow-xs">
                <div className="font-mono text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                  Final Score
                </div>
                <div className="font-bold text-2xl sm:text-3xl text-slate-900 mt-1">
                  {userScore > 0 ? `+${userScore}` : userScore}
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  out of {contest.totalMarks} marks
                </div>
              </div>

              {/* Rank */}
              <div className="bg-white border border-[#0c1d2d]/10 rounded-xl p-4 shadow-xs">
                <div className="font-mono text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                  Standings Rank
                </div>
                <div className="font-bold text-2xl sm:text-3xl text-slate-900 mt-1">
                  {userRank ? `#${userRank}` : 'Unranked'}
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  against competitors
                </div>
              </div>

              {/* Accuracy */}
              <div className="bg-white border border-[#0c1d2d]/10 rounded-xl p-4 shadow-xs">
                <div className="font-mono text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                  Accuracy Rate
                </div>
                <div className="font-bold text-2xl sm:text-3xl text-slate-900 mt-1">
                  {userAccuracy}%
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  {correctCount} correct • {wrongCount} wrong
                </div>
              </div>

              {/* Time Taken */}
              <div className="bg-white border border-[#0c1d2d]/10 rounded-xl p-4 shadow-xs">
                <div className="font-mono text-[10px] font-semibold uppercase text-slate-500 tracking-wider">
                  Time Spent
                </div>
                <div className="font-bold text-2xl sm:text-3xl text-slate-900 mt-1">
                  {formatSeconds(userTime)}
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  of {contest.durationMinutes}m limit
                </div>
              </div>

              {/* XP Won */}
              <div className="bg-white border border-amber-200/80 rounded-xl p-4 shadow-xs bg-gradient-to-b from-amber-50/30 to-white col-span-2 lg:col-span-1">
                <div className="font-mono text-[10px] font-bold uppercase text-amber-900/80 tracking-wider">
                  XP Won
                </div>
                <div className="font-bold text-2xl sm:text-3xl text-amber-600 mt-1 flex items-center gap-1">
                  <Zap className="w-5 h-5 fill-amber-500 text-amber-500" />
                  <span>+{userXp}</span>
                </div>
                <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                  Tournament XP
                </div>
              </div>
            </div>

            {/* Answer Breakdown Strip */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-around text-center text-xs font-mono">
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Correct</span>
                <div className="text-emerald-700 font-bold text-base mt-0.5">{correctCount}</div>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Wrong</span>
                <div className="text-rose-700 font-bold text-base mt-0.5">{wrongCount}</div>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-semibold">Unattempted</span>
                <div className="text-slate-700 font-bold text-base mt-0.5">{unattemptedCount}</div>
              </div>
            </div>
          </section>
        )}

        {/* ================================================= */}
        {/* TABS: LEADERBOARD VS ANSWER REVIEW                */}
        {/* ================================================= */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'overview'
                ? 'bg-[#ffd43b] text-[#0c1d2d] border-amber-400 font-bold shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
            }`}
          >
            Tournament Leaderboard ({leaderboard.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`px-3.5 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === 'review'
                ? 'bg-[#ffd43b] text-[#0c1d2d] border-amber-400 font-bold shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
            }`}
          >
            Solutions & Review ({reviewQuestions.length}Q)
          </button>
        </div>

        {/* ================================================= */}
        {/* TAB 1: GLOBAL LEADERBOARD                         */}
        {/* ================================================= */}
        {activeTab === 'overview' && (
          <section className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Standings & Rankings
                </h3>
              </div>
              <span className="font-mono text-[10px] font-semibold text-slate-500 uppercase">
                Ranked by Score Desc • Time Asc
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-sm text-slate-800">
                  No Completed Submissions Yet
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Leaderboard standings populate immediately as competitors submit their arena answers.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 font-mono text-[11px] font-semibold uppercase text-slate-500">
                      <th className="py-2.5 px-4">Rank</th>
                      <th className="py-2.5 px-4">Competitor</th>
                      <th className="py-2.5 px-4 text-right">Score</th>
                      <th className="py-2.5 px-4 text-right">Accuracy</th>
                      <th className="py-2.5 px-4 text-right">Time</th>
                      <th className="py-2.5 px-4 text-right">XP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaderboard.map((entry, i) => {
                      return (
                        <tr
                          key={entry.userId || i}
                          className={`text-xs hover:bg-slate-50 transition-colors ${
                            entry.rank === 1 ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-bold text-sm">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                                entry.rank === 1
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : entry.rank === 2
                                  ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                  : entry.rank === 3
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'text-slate-600'
                              }`}
                            >
                              {entry.rank}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-xs sm:text-sm text-slate-900">
                              {entry.displayName || entry.username}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              @{entry.username}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-xs sm:text-sm text-slate-900">
                            {entry.totalScore > 0 ? `+${entry.totalScore}` : entry.totalScore}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-600">
                            {entry.accuracyPercentage}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs text-slate-500">
                            {formatSeconds(entry.timeTakenSeconds)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs text-sky-600">
                            +{entry.xpAwarded}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ================================================= */}
        {/* TAB 2: SOLUTIONS & DETAILED REVIEW                */}
        {/* ================================================= */}
        {activeTab === 'review' && (
          <section className="space-y-3">
            {reviewQuestions.length === 0 ? (
              <div className="p-8 bg-white border border-slate-200 rounded-xl shadow-sm text-center">
                <HelpCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <h3 className="font-bold text-base text-slate-900">
                  Review Currently Locked
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Answer reviews unlock immediately upon submission or after the contest officially concludes.
                </p>
              </div>
            ) : (
              reviewQuestions.map((q, idx) => {
                const isExpanded = expandedQuestionId === q.questionId
                const isAttempted = q.selectedOption !== null && q.selectedOption !== ''

                return (
                  <div
                    key={q.questionId}
                    className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-sm overflow-hidden"
                  >
                    {/* Collapsible Accordion Header */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedQuestionId(isExpanded ? null : q.questionId)
                      }
                      className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center font-mono font-bold text-xs bg-slate-50 text-slate-700 shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-sm text-slate-900">
                            {q.title}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">
                            {q.topic} • {q.difficulty.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {isAttempted ? (
                          q.isCorrect ? (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Correct (+{q.marksAwarded})</span>
                            </span>
                          ) : (
                            <span className="bg-rose-50 text-rose-800 border border-rose-200 rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Incorrect ({q.marksAwarded})</span>
                            </span>
                          )
                        ) : (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 rounded-md px-2 py-0.5 font-mono text-[10px] font-medium">
                            Unattempted (0)
                          </span>
                        )}

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Collapsible Accordion Body */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/40 space-y-3.5">
                        {/* Prompt */}
                        <div className="p-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 font-normal whitespace-pre-line leading-relaxed">
                          {q.prompt}
                        </div>

                        {/* Options */}
                        <div className="space-y-2">
                          {q.options.map((opt) => {
                            const isUserPick = q.selectedOption === opt.id
                            const isCorrectOpt = q.correctOption === opt.id

                            let style = 'bg-white border-slate-200 text-slate-800'
                            if (isCorrectOpt) {
                              style = 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold'
                            } else if (isUserPick && !q.isCorrect) {
                              style = 'bg-rose-50 border-rose-300 text-rose-950'
                            }

                            return (
                              <div
                                key={opt.id}
                                className={`p-3 rounded-lg border text-xs sm:text-sm flex items-start gap-2.5 ${style}`}
                              >
                                <span className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center font-mono font-bold text-xs shrink-0 bg-white text-slate-700">
                                  {opt.id}
                                </span>
                                <div className="flex-1 mt-0.5 leading-snug">
                                  <span>{opt.text}</span>
                                </div>
                                {isCorrectOpt && (
                                  <span className="font-mono text-[10px] font-bold uppercase text-emerald-700">
                                    [Correct]
                                  </span>
                                )}
                                {isUserPick && !isCorrectOpt && (
                                  <span className="font-mono text-[10px] font-bold uppercase text-rose-700">
                                    [Your Choice]
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Explanation */}
                        <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 uppercase tracking-wider">
                            <BookOpen className="w-4 h-4 text-slate-500" />
                            <span>Official Solution & Derivation</span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
                            {q.explanation}
                          </p>
                          {q.formulaOrRule && (
                            <div className="mt-2 p-2 bg-amber-50/60 border border-amber-200/60 rounded-md font-mono text-xs text-amber-900">
                              Formula / Core Rule: {q.formulaOrRule}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </section>
        )}
      </div>
    </AppLayout>
  )
}
