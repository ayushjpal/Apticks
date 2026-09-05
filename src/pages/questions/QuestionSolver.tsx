import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bookmark,
  Sparkles,
  HelpCircle,
  Edit3,
  RotateCcw,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Timer,
  Award,
  Zap,
  Tag,
  ShieldAlert,
  Flame,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { QuestionService } from '../../services/questionService'
import { ChallengeService } from '../../services/challengeService'
import type { Question, UserQuestionProgress } from '../../types/questions'
import AppLayout from '../../components/layout/AppLayout'

export default function QuestionSolver() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isChallengeMode = searchParams.get('challenge') === 'true'
  const challengeId = searchParams.get('challengeId')
  const [resolvedChallengeId, setResolvedChallengeId] = useState<string | null>(challengeId)

  // App & Question State
  const [userId, setUserId] = useState<string | undefined>()
  const [question, setQuestion] = useState<Question | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  // Solver State
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [authoritativeCorrectOption, setAuthoritativeCorrectOption] = useState<string | null>(null)
  const [authoritativeExplanation, setAuthoritativeExplanation] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeSpent, setTimeSpent] = useState(0)
  const [timerActive, setTimerActive] = useState(true)

  // Attempt & XP Result State
  const [xpResult, setXpResult] = useState<{
    xpChange: number
    xpReason: string
    attemptNumber: number
  } | null>(null)
  const [questionAttemptStats, setQuestionAttemptStats] = useState<{
    totalAttempts: number
    correctCount: number
    incorrectCount: number
  } | null>(null)

  // Interactive Tools
  const [showHint, setShowHint] = useState(false)
  const [showScratchpad, setShowScratchpad] = useState(false)
  const [scratchpadNotes, setScratchpadNotes] = useState('')
  const [isBookmarked, setIsBookmarked] = useState(false)

  const timerRef = useRef<number | null>(null)

  // ---------------------------------------------------------------------------
  // 1. Load Question & User Data
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    const loadQuestionData = async () => {
      if (!id) return
      setLoading(true)
      setIsSubmitted(false)
      setIsCorrect(null)
      setSelectedOption(null)
      setShowHint(false)
      setTimeSpent(0)
      setTimerActive(true)
      setXpResult(null)
      setAuthoritativeCorrectOption(null)
      setAuthoritativeExplanation(null)

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user && isMounted) {
          setUserId(user.id)
        }

        // =====================================================================
        // A. DAILY CHALLENGE MODE: Authoritative RPC Retrieval
        // =====================================================================
        if (isChallengeMode) {
          const [dailyChallenge, fetchedList, attemptStats] = await Promise.all([
            ChallengeService.getDailyChallenge(),
            QuestionService.getQuestions(),
            user?.id
              ? QuestionService.getQuestionAttempts(id, user.id)
              : Promise.resolve({ attempts: [], totalAttempts: 0, correctCount: 0, incorrectCount: 0 }),
          ])

          if (!isMounted) return

          if (dailyChallenge && dailyChallenge.question) {
            setQuestion(dailyChallenge.question)
            setAllQuestions(fetchedList)
            setResolvedChallengeId(dailyChallenge.challengeId)
            setQuestionAttemptStats({
              totalAttempts: attemptStats.totalAttempts,
              correctCount: attemptStats.correctCount,
              incorrectCount: attemptStats.incorrectCount,
            })

            // Only treat the challenge as completed when challenge.isCompleted is true.
            // Do NOT rely on normal user_question_progress.isSolved.
            if (dailyChallenge.isCompleted) {
              setIsSubmitted(true)
              setIsCorrect(true)
              setTimerActive(false)
              setXpResult({
                xpChange: dailyChallenge.bonusXpAwarded || dailyChallenge.bonusXp,
                xpReason: 'Daily Challenge completed today (+50 BONUS XP)',
                attemptNumber: 1,
              })
            }
            return
          } else {
            // Challenge could not be loaded - safely redirect back to Dashboard
            navigate('/dashboard', { replace: true })
            return
          }
        }

        // =====================================================================
        // B. STANDARD QUESTION BANK PRACTICE FLOW (Completely Unchanged)
        // =====================================================================
        const [foundQuestion, fetchedList, progressMap, attemptStats] =
          await Promise.all([
            QuestionService.getQuestionById(id),
            QuestionService.getQuestions(),
            user?.id
              ? QuestionService.getUserProgress(user.id)
              : Promise.resolve<Record<string, UserQuestionProgress>>({}),
            user?.id
              ? QuestionService.getQuestionAttempts(id, user.id)
              : Promise.resolve({ attempts: [], totalAttempts: 0, correctCount: 0, incorrectCount: 0 }),
          ])

        if (!foundQuestion) {
          navigate('/questions', { replace: true })
          return
        }

        if (isMounted) {
          setQuestion(foundQuestion)
          setAllQuestions(fetchedList)
          setQuestionAttemptStats({
            totalAttempts: attemptStats.totalAttempts,
            correctCount: attemptStats.correctCount,
            incorrectCount: attemptStats.incorrectCount,
          })

          const p = progressMap[id]
          if (p) {
            setIsBookmarked(p.isBookmarked)
            if (p.isSolved) {
              setSelectedOption(p.selectedOption || null)
              setIsSubmitted(true)
              setIsCorrect(p.isCorrect)
              setTimerActive(false)
            }
          }
        }
      } catch (err) {
        console.error('Error loading question solver:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadQuestionData()

    return () => {
      isMounted = false
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [id, navigate, isChallengeMode])

  // ---------------------------------------------------------------------------
  // 2. Stopwatch Timer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (timerActive && !isSubmitted) {
      timerRef.current = window.setInterval(() => {
        setTimeSpent((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerActive, isSubmitted])

  // ---------------------------------------------------------------------------
  // 3. Submit Answer with Competitive XP & Attempt History Logging
  // ---------------------------------------------------------------------------
  const handleSubmitAnswer = async () => {
    if (!selectedOption || !question || isSubmitted || isSubmitting) return

    setTimerActive(false)

    // A. Daily Challenge Mode: Authoritative Server RPC Check
    const targetChallengeId = resolvedChallengeId || challengeId
    if (isChallengeMode && targetChallengeId) {
      setIsSubmitting(true)
      try {
        const res = await ChallengeService.submitDailyChallenge(
          targetChallengeId,
          selectedOption,
          timeSpent
        )

        setIsSubmitted(true)
        setIsCorrect(res.isCorrect)

        if (res.correctOption) {
          setAuthoritativeCorrectOption(res.correctOption)
        }
        if (res.explanation) {
          setAuthoritativeExplanation(res.explanation)
        }

        const totalEarned = (res.bonusXp || 0) + (res.questionXp || (res.isCorrect ? question.points : 0))
        setXpResult({
          xpChange: res.isCorrect ? totalEarned : (res.xpChange !== undefined ? res.xpChange : 0),
          xpReason: res.bonusXp > 0
            ? `+${res.bonusXp} Daily Bonus + ${res.questionXp || question.points} Problem XP`
            : (res.alreadyCompleted ? 'Challenge completed (+0 Bonus XP)' : (res.message || 'Challenge attempt logged')),
          attemptNumber: 1,
        })

        if (userId) {
          const stats = await QuestionService.getQuestionAttempts(question.id, userId)
          setQuestionAttemptStats({
            totalAttempts: stats.totalAttempts,
            correctCount: stats.correctCount,
            incorrectCount: stats.incorrectCount,
          })
        }
      } catch (err) {
        console.warn('Daily challenge submit error:', err)
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // B. Standard Question Bank Practice Flow
    setIsSubmitted(true)
    const correct = selectedOption === question.correctOption
    setIsCorrect(correct)

    try {
      const res = await QuestionService.submitAnswer(
        question.id,
        selectedOption,
        timeSpent,
        userId
      )
      setXpResult({
        xpChange: res.xpChange,
        xpReason: res.xpReason,
        attemptNumber: res.attemptNumber,
      })

      // Refresh question-specific attempt statistics
      if (userId) {
        const stats = await QuestionService.getQuestionAttempts(question.id, userId)
        setQuestionAttemptStats({
          totalAttempts: stats.totalAttempts,
          correctCount: stats.correctCount,
          incorrectCount: stats.incorrectCount,
        })
      }
    } catch (err) {
      console.warn('Progress save notice:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Toggle Bookmark
  // ---------------------------------------------------------------------------
  const handleToggleBookmark = async () => {
    if (!question) return
    const newStatus = !isBookmarked
    setIsBookmarked(newStatus)

    try {
      await QuestionService.toggleBookmark(question.id, userId)
    } catch (err) {
      console.warn('Bookmark toggle error:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Navigate to Next Question in Pool
  // ---------------------------------------------------------------------------
  const handleNextQuestion = () => {
    if (!question || allQuestions.length === 0) {
      navigate('/questions')
      return
    }

    const currentIndex = allQuestions.findIndex((q) => q.id === question.id)
    const nextIndex = (currentIndex + 1) % allQuestions.length
    const nextQ = allQuestions[nextIndex]

    if (nextQ) {
      navigate(`/questions/${nextQ.id}`)
    } else {
      navigate('/questions')
    }
  }

  // Helper to format seconds into mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading || !question) {
    return (
      <AppLayout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 border-4 border-black border-t-[#ffd43b] rounded-full animate-spin mb-4" />
          <div className="font-display font-black text-xl uppercase tracking-wider text-black">
            LOADING ARENA QUESTION...
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* ================================================= */}
        {/* TOP BAR / NAVIGATION                              */}
        {/* ================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-black">
          <Link
            to="/questions"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] transition-transform hover:-translate-x-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO QUESTION BANK</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Stopwatch HUD */}
            <div
              className={`
                px-3 py-1.5 border-2 border-black rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-[2px_2px_0_#000000]
                ${timerActive && !isSubmitted ? 'bg-[#ffd43b] animate-pulse' : 'bg-white'}
              `}
            >
              <Timer className="w-4 h-4" />
              <span>{formatTimer(timeSpent)}</span>
            </div>

            {/* Bookmark Button */}
            <button
              type="button"
              onClick={handleToggleBookmark}
              aria-label={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
              className={`
                p-2 border-2 border-black rounded-xl shadow-[2px_2px_0_#000000] transition-transform hover:-translate-y-0.5 cursor-pointer
                ${isBookmarked ? 'bg-[#ffd43b]' : 'bg-white hover:bg-slate-100'}
              `}
            >
              <Bookmark
                className={`w-4 h-4 ${isBookmarked ? 'fill-black text-black' : 'text-black'}`}
              />
            </button>
          </div>
        </div>

        {/* ================================================= */}
        {/* DAILY CHALLENGE BANNER                            */}
        {/* ================================================= */}
        {isChallengeMode && (
          <div className="bg-[#ffd43b] border-2 sm:border-3 border-black rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_#000000] flex flex-wrap items-center justify-between gap-3 animate-entry">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0">
                <Flame className="w-6 h-6 text-[#ffd43b] fill-[#ffd43b]" />
              </div>
              <div>
                <div className="font-display font-black text-base uppercase text-black leading-tight">
                  DAILY CHALLENGE ARENA
                </div>
                <div className="font-mono text-xs font-bold text-black/80 mt-0.5">
                  Authoritative daily problem. First correct solve unlocks +50 BONUS XP & extends streak!
                </div>
              </div>
            </div>
            <div className="bg-[#ff5b5b] text-white border-2 border-black rounded-full px-3 py-1 font-mono text-xs font-black uppercase shadow-[2px_2px_0_#000000]">
              +50 BONUS XP
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* QUESTION HEADER CARD                              */}
        {/* ================================================= */}
        <div className="bg-white border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[6px_6px_0_#000000] p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
            <span className="px-2.5 py-1 bg-[#071a2b] text-[#ffd43b] border-2 border-black rounded-lg font-mono font-black text-[10px] uppercase">
              {question.category}
            </span>
            <span className="px-2.5 py-1 bg-[#e9f6ff] text-black border-2 border-black rounded-lg font-mono font-bold text-[10px] uppercase">
              {question.topic}
            </span>
            <span
              className={`
                px-2.5 py-1 border-2 border-black rounded-lg font-mono font-black text-[10px] uppercase
                ${
                  question.difficulty === 'easy'
                    ? 'bg-[#32e875] text-black'
                    : question.difficulty === 'medium'
                      ? 'bg-[#ffd43b] text-black'
                      : 'bg-[#ff5b5b] text-white'
                }
              `}
            >
              {question.difficulty}
            </span>

            <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-[#ffd43b] border-2 border-black rounded-lg font-display font-black text-xs text-black">
              <Award className="w-3.5 h-3.5" />
              <span>{question.points} XP</span>
            </div>
          </div>

          <h1 className="font-display font-black text-xl sm:text-2xl text-black uppercase tracking-tight leading-tight">
            {question.title}
          </h1>

          <div className="mt-4 pt-4 border-t-2 border-dashed border-black/30 font-body font-bold text-base sm:text-lg text-black/90 leading-relaxed whitespace-pre-line">
            {question.prompt}
          </div>
        </div>

        {/* ================================================= */}
        {/* OPTIONS SELECTION                                 */}
        {/* ================================================= */}
        <section
          aria-label="Options"
          className="bg-white border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[6px_6px_0_#000000] p-6 sm:p-8"
        >
          <div className="font-mono text-xs font-black text-black/60 uppercase mb-4 tracking-wider">
            CHOOSE THE CORRECT RESPONSE:
          </div>

          <div className="grid grid-cols-1 gap-3">
            {question.options.map((opt) => {
              const isSelected = selectedOption === opt.id
              const effectiveCorrect = authoritativeCorrectOption || question.correctOption
              const isCorrectOption = opt.id === effectiveCorrect

              let cardBg = 'bg-white hover:bg-slate-50'
              const borderColor = 'border-black'

              if (isSubmitted) {
                if (isCorrectOption) {
                  cardBg = 'bg-[#32e875] text-black'
                } else if (isSelected && !isCorrectOption) {
                  cardBg = 'bg-[#ff5b5b] text-white'
                } else {
                  cardBg = 'bg-slate-100 opacity-60'
                }
              } else if (isSelected) {
                cardBg = 'bg-[#ffd43b] text-black shadow-[4px_4px_0_#000000]'
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => setSelectedOption(opt.id)}
                  className={`
                    p-4 rounded-xl border-2 sm:border-3 ${borderColor} ${cardBg}
                    flex items-center justify-between text-left transition-all cursor-pointer
                    ${!isSubmitted ? 'hover:-translate-y-0.5 active:translate-y-0' : ''}
                  `}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`
                        w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center font-display font-black text-sm
                        ${isSelected ? 'bg-black text-white' : 'bg-[#e9f6ff] text-black'}
                      `}
                    >
                      {opt.id}
                    </span>
                    <span className="font-body font-bold text-sm sm:text-base">
                      {opt.text}
                    </span>
                  </div>

                  {isSubmitted && isCorrectOption && (
                    <CheckCircle2 className="w-5 h-5 text-[#059669] shrink-0" />
                  )}
                  {isSubmitted && isSelected && !isCorrectOption && (
                    <XCircle className="w-5 h-5 text-[#dc2626] shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          {/* =============================================== */}
          {/* ACTIONS: SUBMIT / HINT / SCRATCHPAD              */}
          {/* =============================================== */}
          <div className="mt-6 pt-5 border-t-2 border-black flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className={`px-3.5 py-2 border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center gap-1.5 transition-transform hover:-translate-y-0.5 cursor-pointer ${
                  showHint ? 'bg-[#ffd43b]' : 'bg-white'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>{showHint ? 'HIDE HINT' : 'NEED HINT?'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowScratchpad(!showScratchpad)}
                className={`px-3.5 py-2 border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center gap-1.5 transition-transform hover:-translate-y-0.5 cursor-pointer ${
                  showScratchpad ? 'bg-[#38aef0]' : 'bg-white'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                <span>SCRATCHPAD</span>
              </button>
            </div>

            {!isSubmitted ? (
              <button
                type="button"
                onClick={handleSubmitAnswer}
                disabled={!selectedOption || isSubmitting}
                className="px-7 py-3 bg-[#32e875] hover:bg-[#22c55e] border-2 sm:border-3 border-black rounded-xl shadow-[3.5px_3.5px_0_#000000] font-display font-black text-sm uppercase tracking-wider transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span>{isSubmitting ? 'PROCESSING...' : 'LOCK & SUBMIT ANSWER'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsSubmitted(false)
                    setIsCorrect(null)
                    setSelectedOption(null)
                    setTimerActive(true)
                  }}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>RE-ATTEMPT</span>
                </button>

                {isChallengeMode ? (
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="px-6 py-2.5 bg-[#32e875] hover:bg-[#22c55e] border-2 sm:border-3 border-black rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider shadow-[3px_3px_0_#000000] flex items-center gap-2 cursor-pointer transition-transform hover:-translate-x-0.5"
                  >
                    <span>RETURN TO DASHBOARD</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-6 py-2.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 sm:border-3 border-black rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider shadow-[3px_3px_0_#000000] flex items-center gap-2 cursor-pointer transition-transform hover:-translate-x-0.5"
                  >
                    <span>NEXT PROBLEM</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ================================================= */}
        {/* HINT DRAWER                                       */}
        {/* ================================================= */}
        {showHint && question.hints && question.hints.length > 0 && (
          <div className="p-5 bg-[#fffde7] border-3 border-black rounded-2xl shadow-[4px_4px_0_#000000] animate-entry">
            <div className="flex items-center gap-2 font-display font-black text-xs uppercase text-[#926002] mb-2">
              <Sparkles className="w-4 h-4" />
              <span>ARENA COACH HINTS:</span>
            </div>
            <ul className="space-y-1.5 list-disc list-inside font-body font-semibold text-xs sm:text-sm text-black/85 leading-relaxed">
              {question.hints.map((hintText, idx) => (
                <li key={idx}>{hintText}</li>
              ))}
            </ul>
          </div>
        )}

        {/* ================================================= */}
        {/* SCRATCHPAD DRAWER                                 */}
        {/* ================================================= */}
        {showScratchpad && (
          <div className="p-5 bg-[#e9f6ff] border-3 border-black rounded-2xl shadow-[4px_4px_0_#000000] animate-entry">
            <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-black">
              <span className="font-display font-black text-xs uppercase text-[#071a2b]">
                DIGITAL CALCULATION SCRATCHPAD
              </span>
              <span className="font-mono text-[10px] font-bold text-black/60">
                Notes stay in this session
              </span>
            </div>
            <textarea
              value={scratchpadNotes}
              onChange={(e) => setScratchpadNotes(e.target.value)}
              placeholder="Jot down rough calculations, formulas, or step-by-step logic here..."
              rows={4}
              className="w-full p-3 bg-white border-2 border-black rounded-xl font-mono text-xs font-bold outline-none focus:shadow-[2px_2px_0_#38aef0]"
            />
          </div>
        )}

        {/* ================================================= */}
        {/* EXPLANATION & COMPETITIVE SUMMARY (AFTER SUBMIT)  */}
        {/* ================================================= */}
        {isSubmitted && (
          <div
            className={`
              p-6 border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[6px_6px_0_#000000] animate-entry
              ${isCorrect ? 'bg-[#d1fae5]' : 'bg-[#fee2e2]'}
            `}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b-2 border-black">
              <div className="flex items-center gap-2.5">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-[#065f46] shrink-0" />
                    <div>
                      <span className="font-display font-black text-base sm:text-lg uppercase text-[#065f46]">
                        {xpResult && xpResult.xpChange === 0
                          ? 'CORRECT REATTEMPT! (+0 XP — ALREADY EARNED)'
                          : `CORRECT! +${xpResult?.xpChange ?? question.points} XP EARNED`}
                      </span>
                      {xpResult?.xpReason && (
                        <div className="font-mono text-[10px] font-bold text-[#065f46]/80">
                          {xpResult.xpReason}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-6 h-6 text-[#991b1b] shrink-0" />
                    <div>
                      <span className="font-display font-black text-base sm:text-lg uppercase text-[#991b1b]">
                        INCORRECT ATTEMPT • {xpResult?.xpChange ?? -Math.max(1, Math.round(question.points * 0.25))} XP PENALTY
                      </span>
                      <div className="font-mono text-[10px] font-bold text-[#991b1b]/80">
                        CORRECT ANSWER IS OPTION {authoritativeCorrectOption || question.correctOption}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Question-Specific Attempt Breakdown */}
              <div className="flex items-center gap-2">
                {questionAttemptStats && (
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-black uppercase bg-white px-2.5 py-1 border-2 border-black rounded-lg shadow-[1.5px_1.5px_0_#000000]">
                    <span>ATTEMPTS: {questionAttemptStats.totalAttempts}</span>
                    <span>•</span>
                    <span className="text-[#059669]">CORRECT: {questionAttemptStats.correctCount}</span>
                    <span>•</span>
                    <span className="text-[#dc2626]">INCORRECT: {questionAttemptStats.incorrectCount}</span>
                  </div>
                )}
                <div className="font-mono text-xs font-black text-black">
                  SOLVE TIME: {formatTimer(timeSpent)}
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-2 border-black rounded-xl font-body font-semibold text-xs sm:text-sm text-black/85 leading-relaxed">
              <div className="font-display font-black text-xs uppercase text-black mb-1.5">
                STEP-BY-STEP MATHEMATICAL SOLUTION:
              </div>
              <div className="whitespace-pre-line">{authoritativeExplanation || question.explanation}</div>

              {question.formulaOrRule && (
                <div className="mt-3 p-3 bg-[#fffde7] border-2 border-black rounded-lg font-mono text-xs font-bold text-black flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#ffd43b] shrink-0" />
                  <span>FORMULA / KEY PRINCIPLE: {question.formulaOrRule}</span>
                </div>
              )}
            </div>

            {/* Question Tags */}
            {question.tags && question.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-black/60" />
                {question.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-white border border-black rounded-md font-mono text-[10px] font-bold text-black/80"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
