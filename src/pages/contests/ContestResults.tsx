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
          <div className="text-center font-display font-black">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-black/40 mb-3" />
            <p className="text-xs tracking-wider uppercase text-black/70">
              CALCULATING ARENA RESULTS & STANDINGS...
            </p>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (!contest) {
    return (
      <AppLayout>
        <div className="p-8 bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] text-center max-w-lg mx-auto mt-12">
          <Trophy className="w-12 h-12 mx-auto text-black/30 mb-3" />
          <h2 className="font-display font-black text-xl uppercase text-black">
            CONTEST NOT FOUND
          </h2>
          <Link
            to="/contests"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#0c1d2d]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>RETURN TO CONTESTS</span>
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
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 animate-entry max-w-5xl mx-auto pb-12">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/contests')}
            className="inline-flex items-center gap-1.5 font-display font-black text-xs uppercase text-black hover:text-[#38aef0] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ALL TOURNAMENTS</span>
          </button>

          <span className="font-mono text-xs font-bold text-black/60 uppercase">
            CONTEST ARENA // TOURNAMENT REPORT
          </span>
        </div>

        {/* ================================================= */}
        {/* HERO RESULTS CARD                                 */}
        {/* ================================================= */}
        <section className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] p-5 sm:p-7">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="bg-[#ffd43b] text-black border-2 border-[#0c1d2d] rounded-full px-2.5 py-0.5 font-mono font-black text-[10px] uppercase">
                  {contest.category}
                </span>
                <span className="bg-black text-white border-2 border-[#0c1d2d] rounded-full px-2.5 py-0.5 font-mono font-black text-[10px] uppercase flex items-center gap-1">
                  <Flame className="w-3 h-3 fill-[#ffd43b] text-[#ffd43b]" />
                  ARENA REPORT
                </span>
              </div>

              <h1 className="font-display font-black text-2xl sm:text-3xl uppercase text-black leading-tight">
                {contest.title}
              </h1>
              <p className="mt-1 text-xs sm:text-sm font-body font-semibold text-black/70">
                Official tournament conclusion, verified server grading, and athlete standings.
              </p>
            </div>

            {/* Quick action: Re-enter arena if live and not submitted, or view standings */}
            {contest.status === 'live' && !isUserCompleted && (
              <button
                type="button"
                onClick={() => navigate(`/contests/${contest.id}/arena`)}
                className="px-5 py-3 bg-[#ff5b5b] hover:bg-[#ef4444] text-white border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#0c1d2d] shrink-0 flex items-center gap-1.5"
              >
                <Flame className="w-4 h-4 fill-white" />
                <span>RESUME ARENA SESSION →</span>
              </button>
            )}
          </div>
        </section>

        {/* ================================================= */}
        {/* ATHLETE PERFORMANCE STATS (IF USER COMPLETED)     */}
        {/* ================================================= */}
        {isUserCompleted && (
          <section className="space-y-3">
            <div className="flex items-center gap-2 font-display font-black text-xs uppercase text-black">
              <Award className="w-4 h-4 text-black" />
              <span>YOUR VERIFIED PERFORMANCE</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Score */}
              <div className="bg-[#ffd43b] border-2 border-[#0c1d2d] rounded-xl p-3.5 shadow-[3px_3px_0_#0c1d2d]">
                <div className="font-mono text-[10px] font-black uppercase text-black/70">
                  FINAL SCORE
                </div>
                <div className="font-display font-black text-2xl sm:text-3xl text-black mt-1">
                  {userScore > 0 ? `+${userScore}` : userScore}
                </div>
                <div className="font-mono text-[10px] font-bold text-black/70 mt-0.5">
                  out of {contest.totalMarks} marks
                </div>
              </div>

              {/* Rank */}
              <div className="bg-[#38aef0] border-2 border-[#0c1d2d] rounded-xl p-3.5 shadow-[3px_3px_0_#0c1d2d]">
                <div className="font-mono text-[10px] font-black uppercase text-black/80">
                  STANDINGS RANK
                </div>
                <div className="font-display font-black text-2xl sm:text-3xl text-black mt-1">
                  {userRank ? `#${userRank}` : 'UNRANKED'}
                </div>
                <div className="font-mono text-[10px] font-bold text-black/80 mt-0.5">
                  against registered solvers
                </div>
              </div>

              {/* Accuracy */}
              <div className="bg-[#32e875] border-2 border-[#0c1d2d] rounded-xl p-3.5 shadow-[3px_3px_0_#0c1d2d]">
                <div className="font-mono text-[10px] font-black uppercase text-black/80">
                  ACCURACY RATE
                </div>
                <div className="font-display font-black text-2xl sm:text-3xl text-black mt-1">
                  {userAccuracy}%
                </div>
                <div className="font-mono text-[10px] font-bold text-black/80 mt-0.5">
                  {correctCount} correct • {wrongCount} incorrect
                </div>
              </div>

              {/* Time Taken */}
              <div className="bg-white border-2 border-[#0c1d2d] rounded-xl p-3.5 shadow-[3px_3px_0_#0c1d2d]">
                <div className="font-mono text-[10px] font-black uppercase text-black/60">
                  TIME SPENT
                </div>
                <div className="font-display font-black text-2xl sm:text-3xl text-black mt-1">
                  {formatSeconds(userTime)}
                </div>
                <div className="font-mono text-[10px] font-bold text-black/60 mt-0.5">
                  of {contest.durationMinutes}m limit
                </div>
              </div>

              {/* XP Won */}
              <div className="bg-black text-[#ffd43b] border-2 border-[#0c1d2d] rounded-xl p-3.5 shadow-[3px_3px_0_#0c1d2d] col-span-2 lg:col-span-1">
                <div className="font-mono text-[10px] font-black uppercase text-[#ffd43b]/80">
                  XP WON
                </div>
                <div className="font-display font-black text-2xl sm:text-3xl text-[#ffd43b] mt-1 flex items-center gap-1">
                  <Zap className="w-5 h-5 fill-[#ffd43b]" />
                  <span>+{userXp}</span>
                </div>
                <div className="font-mono text-[10px] font-bold text-[#ffd43b]/70 mt-0.5">
                  Competitive Tournament XP
                </div>
              </div>
            </div>

            {/* Answer Breakdown Strip */}
            <div className="p-3 bg-[#faf9f6] border-2 border-[#0c1d2d] rounded-xl flex items-center justify-around text-center text-xs font-mono font-black">
              <div>
                <span className="text-black/60 uppercase text-[10px]">CORRECT</span>
                <div className="text-[#166534] text-base">{correctCount}</div>
              </div>
              <div className="h-6 w-0.5 bg-black/20" />
              <div>
                <span className="text-black/60 uppercase text-[10px]">WRONG</span>
                <div className="text-[#991b1b] text-base">{wrongCount}</div>
              </div>
              <div className="h-6 w-0.5 bg-black/20" />
              <div>
                <span className="text-black/60 uppercase text-[10px]">UNATTEMPTED</span>
                <div className="text-black/70 text-base">{unattemptedCount}</div>
              </div>
            </div>
          </section>
        )}

        {/* ================================================= */}
        {/* TABS: LEADERBOARD VS ANSWER REVIEW                */}
        {/* ================================================= */}
        <div className="flex items-center gap-2 border-b-2 border-[#0c1d2d] pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#0c1d2d] cursor-pointer transition-all ${
              activeTab === 'overview'
                ? 'bg-[#ffd43b] text-black -translate-y-0.5'
                : 'bg-white text-black/80 hover:bg-[#e9f6ff]'
            }`}
          >
            GLOBAL LEADERBOARD ({leaderboard.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`px-4 py-2 border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#0c1d2d] cursor-pointer transition-all ${
              activeTab === 'review'
                ? 'bg-[#ffd43b] text-black -translate-y-0.5'
                : 'bg-white text-black/80 hover:bg-[#e9f6ff]'
            }`}
          >
            SOLUTIONS & REVIEW ({reviewQuestions.length}Q)
          </button>
        </div>

        {/* ================================================= */}
        {/* TAB 1: GLOBAL LEADERBOARD                         */}
        {/* ================================================= */}
        {activeTab === 'overview' && (
          <section className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] overflow-hidden">
            <div className="p-4 border-b-2 border-[#0c1d2d] flex items-center justify-between bg-[#faf9f6]">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-black" />
                <h3 className="font-display font-black text-base uppercase text-black">
                  ARENA LEADERBOARD & PODIUM
                </h3>
              </div>
              <span className="font-mono text-[10px] font-bold text-black/60 uppercase">
                RANKED BY SCORE DESC • TIME ASC
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-black/60">
                <Users className="w-10 h-10 mx-auto text-black/30 mb-2" />
                <p className="font-display font-black text-sm uppercase text-black">
                  NO COMPLETED SUBMISSIONS YET
                </p>
                <p className="text-xs font-body font-semibold mt-1">
                  Leaderboard standings populate immediately as athletes submit their arena answers.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#0c1d2d] bg-[#f1f5f9] font-mono text-[10px] font-black uppercase text-black">
                      <th className="py-2.5 px-4">RANK</th>
                      <th className="py-2.5 px-4">ATHLETE</th>
                      <th className="py-2.5 px-4 text-right">SCORE</th>
                      <th className="py-2.5 px-4 text-right">ACCURACY</th>
                      <th className="py-2.5 px-4 text-right">TIME</th>
                      <th className="py-2.5 px-4 text-right">XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, i) => {
                      return (
                        <tr
                          key={entry.userId || i}
                          className={`border-b border-[#0c1d2d]/10 font-body font-bold text-xs hover:bg-[#f8fafc] transition-colors ${
                            entry.rank === 1 ? 'bg-[#fffde7]' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-mono font-black text-sm">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[#0c1d2d] font-mono font-black text-xs ${
                                entry.rank === 1
                                  ? 'bg-[#ffd43b] text-black'
                                  : entry.rank === 2
                                  ? 'bg-slate-200 text-black'
                                  : entry.rank === 3
                                  ? 'bg-[#fed7aa] text-black'
                                  : 'bg-white text-black'
                              }`}
                            >
                              {entry.rank}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-display font-black text-xs sm:text-sm uppercase text-black">
                              {entry.displayName || entry.username}
                            </div>
                            <div className="font-mono text-[10px] font-bold text-black/50">
                              @{entry.username}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-display font-black text-sm sm:text-base text-black">
                            {entry.totalScore > 0 ? `+${entry.totalScore}` : entry.totalScore}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs text-black/80">
                            {entry.accuracyPercentage}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-xs text-black/70">
                            {formatSeconds(entry.timeTakenSeconds)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-xs text-[#2563eb]">
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
          <section className="space-y-4">
            {reviewQuestions.length === 0 ? (
              <div className="p-8 bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] text-center">
                <HelpCircle className="w-10 h-10 mx-auto text-black/30 mb-2" />
                <h3 className="font-display font-black text-base uppercase text-black">
                  REVIEW CURRENTLY LOCKED
                </h3>
                <p className="text-xs font-body font-semibold text-black/60 mt-1">
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
                    className="bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] overflow-hidden"
                  >
                    {/* Collapsible Accordion Header */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedQuestionId(isExpanded ? null : q.questionId)
                      }
                      className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-left hover:bg-[#f8fafc] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-lg border-2 border-[#0c1d2d] flex items-center justify-center font-mono font-black text-xs bg-[#ffd43b] text-black shadow-[1.5px_1.5px_0_#0c1d2d] shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-display font-black text-sm uppercase text-black">
                            {q.title}
                          </div>
                          <div className="font-mono text-[10px] font-bold text-black/50">
                            {q.topic} • {q.difficulty.toUpperCase()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {isAttempted ? (
                          q.isCorrect ? (
                            <span className="bg-[#dcfce7] text-[#166534] border border-[#0c1d2d] rounded-lg px-2 py-0.5 font-mono text-[10px] font-black uppercase flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>CORRECT (+{q.marksAwarded})</span>
                            </span>
                          ) : (
                            <span className="bg-[#fee2e2] text-[#991b1b] border border-[#0c1d2d] rounded-lg px-2 py-0.5 font-mono text-[10px] font-black uppercase flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>INCORRECT ({q.marksAwarded})</span>
                            </span>
                          )
                        ) : (
                          <span className="bg-slate-100 text-black/60 border border-[#0c1d2d] rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                            UNATTEMPTED (0)
                          </span>
                        )}

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-black" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-black" />
                        )}
                      </div>
                    </button>

                    {/* Collapsible Accordion Body */}
                    {isExpanded && (
                      <div className="p-4 sm:p-6 border-t-2 border-[#0c1d2d] bg-[#faf9f6] space-y-4">
                        {/* Prompt */}
                        <div className="p-4 bg-white border-2 border-[#0c1d2d] rounded-xl text-sm font-body font-semibold text-black whitespace-pre-line leading-relaxed">
                          {q.prompt}
                        </div>

                        {/* Options */}
                        <div className="space-y-2">
                          {q.options.map((opt) => {
                            const isUserPick = q.selectedOption === opt.id
                            const isCorrectOpt = q.correctOption === opt.id

                            let style = 'bg-white border-[#0c1d2d]'
                            if (isCorrectOpt) {
                              style = 'bg-[#dcfce7] border-[#166534] text-[#166534] font-black'
                            } else if (isUserPick && !q.isCorrect) {
                              style = 'bg-[#fee2e2] border-[#991b1b] text-[#991b1b]'
                            }

                            return (
                              <div
                                key={opt.id}
                                className={`p-3 rounded-xl border-2 font-body text-xs sm:text-sm flex items-start gap-2.5 ${style}`}
                              >
                                <span className="w-6 h-6 rounded border border-[#0c1d2d] flex items-center justify-center font-mono font-black text-xs shrink-0 bg-white text-black">
                                  {opt.id}
                                </span>
                                <div className="flex-1 mt-0.5 leading-snug">
                                  <span>{opt.text}</span>
                                </div>
                                {isCorrectOpt && (
                                  <span className="font-mono text-[10px] font-black uppercase text-[#166534]">
                                    [CORRECT]
                                  </span>
                                )}
                                {isUserPick && !isCorrectOpt && (
                                  <span className="font-mono text-[10px] font-black uppercase text-[#991b1b]">
                                    [YOUR ANSWER]
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Explanation */}
                        <div className="p-4 bg-white border-2 border-[#0c1d2d] rounded-xl space-y-2">
                          <div className="flex items-center gap-1.5 font-display font-black text-xs uppercase text-black">
                            <BookOpen className="w-4 h-4 text-black" />
                            <span>OFFICIAL EXPLANATION & DERIVATION</span>
                          </div>
                          <p className="text-xs font-body font-semibold text-black/80 leading-relaxed">
                            {q.explanation}
                          </p>
                          {q.formulaOrRule && (
                            <div className="mt-2 p-2.5 bg-[#f1f5f9] border border-[#0c1d2d] rounded-lg font-mono text-[11px] font-bold text-black/80">
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
