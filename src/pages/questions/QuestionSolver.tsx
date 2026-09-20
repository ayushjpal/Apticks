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
import { StatusBadge, NeoBadge } from '../../components/ui'
import { useUserSession } from '../../contexts/UserSessionContext'

export default function QuestionSolver() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isChallengeMode = searchParams.get('challenge') === 'true'
  const challengeId = searchParams.get('challengeId')
  const [resolvedChallengeId, setResolvedChallengeId] = useState<string | null>(challengeId)

  // App & Question State
  const { user: sessionUser, refreshUserMetrics } = useUserSession()
  const [userId, setUserId] = useState<string | undefined>()
  const effectiveUserId = sessionUser?.id || userId
  const [question, setQuestion] = useState<Question | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)

  // In-memory catalog and progress references to ensure 0-network next problem transitions
  const catalogRef = useRef<Question[]>([])
  const progressMapRef = useRef<Record<string, UserQuestionProgress>>({})

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
  // 1. Load Question & User Data (Zero-Network Fast-Path when navigating problems)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    const loadQuestionData = async () => {
      if (!id) return

      // Reset solver state for this specific question
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
        let currentUserId = effectiveUserId
        if (!currentUserId) {
          const {
            data: { user: authUser },
          } = await supabase.auth.getUser()
          if (authUser && isMounted) {
            currentUserId = authUser.id
            setUserId(authUser.id)
          }
        }

        // =====================================================================
        // A. DAILY CHALLENGE MODE: Authoritative RPC Retrieval
        // =====================================================================
        if (isChallengeMode) {
          setLoading(true)
          const [dailyChallenge, fetchedList, attemptStats] = await Promise.all([
            ChallengeService.getDailyChallenge(),
            QuestionService.getQuestions(),
            currentUserId
              ? QuestionService.getQuestionAttempts(id, currentUserId)
              : Promise.resolve({ attempts: [], totalAttempts: 0, correctCount: 0, incorrectCount: 0 }),
          ])

          if (!isMounted) return

          if (dailyChallenge && dailyChallenge.question) {
            setQuestion(dailyChallenge.question)
            setAllQuestions(fetchedList)
            catalogRef.current = fetchedList
            setResolvedChallengeId(dailyChallenge.challengeId)
            setQuestionAttemptStats({
              totalAttempts: attemptStats.totalAttempts,
              correctCount: attemptStats.correctCount,
              incorrectCount: attemptStats.incorrectCount,
            })

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
            setLoading(false)
            return
          } else {
            navigate('/dashboard', { replace: true })
            return
          }
        }

        // =====================================================================
        // B. STANDARD QUESTION BANK PRACTICE FLOW
        // =====================================================================
        // FAST PATH: If questions are already held in memory/cache, resolve in 0ms with ZERO network requests!
        const availableCatalog =
          catalogRef.current.length > 0
            ? catalogRef.current
            : (QuestionService.getCachedQuestions() || [])

        const cachedMatch = availableCatalog.find((q) => q.id === id)

        if (cachedMatch) {
          // Instant memory transition - ZERO question catalog network request
          if (catalogRef.current.length === 0) {
            catalogRef.current = availableCatalog
            setAllQuestions(availableCatalog)
          }

          setQuestion(cachedMatch)
          setLoading(false)

          const p = progressMapRef.current[id]
          if (p) {
            setIsBookmarked(p.isBookmarked)
            if (p.isSolved) {
              setSelectedOption(p.selectedOption || null)
              setIsSubmitted(true)
              setIsCorrect(p.isCorrect)
              setTimerActive(false)
            }
          } else {
            setIsBookmarked(false)
          }

          // Fetch attempt stats in background without touching question catalog or blocking UI
          if (currentUserId) {
            QuestionService.getQuestionAttempts(id, currentUserId)
              .then((stats) => {
                if (isMounted) {
                  setQuestionAttemptStats({
                    totalAttempts: stats.totalAttempts,
                    correctCount: stats.correctCount,
                    incorrectCount: stats.incorrectCount,
                  })
                }
              })
              .catch(() => {})
          }
          return
        }

        // COLD PATH: Initial deep link or hard refresh when catalog not yet cached in memory
        setLoading(true)
        const [foundQuestion, fetchedList, progressMap, attemptStats] =
          await Promise.all([
            QuestionService.getQuestionById(id),
            QuestionService.getQuestions(),
            currentUserId
              ? QuestionService.getUserProgress(currentUserId)
              : Promise.resolve<Record<string, UserQuestionProgress>>({}),
            currentUserId
              ? QuestionService.getQuestionAttempts(id, currentUserId)
              : Promise.resolve({ attempts: [], totalAttempts: 0, correctCount: 0, incorrectCount: 0 }),
          ])

        if (!foundQuestion) {
          navigate('/questions', { replace: true })
          return
        }

        if (isMounted) {
          setQuestion(foundQuestion)
          setAllQuestions(fetchedList)
          catalogRef.current = fetchedList
          progressMapRef.current = progressMap
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
          } else {
            setIsBookmarked(false)
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
  }, [id, navigate, isChallengeMode, effectiveUserId])

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

        const qXp = res.questionXp !== undefined ? res.questionXp : (res.isCorrect && !res.alreadyCompleted ? question.points : 0)
        const totalEarned = res.alreadyCompleted ? 0 : ((res.bonusXp || 0) + qXp)
        setXpResult({
          xpChange: res.alreadyCompleted ? 0 : (res.isCorrect ? totalEarned : (res.xpChange !== undefined ? res.xpChange : 0)),
          xpReason: res.alreadyCompleted
            ? 'Daily Challenge already completed today (+0 XP)'
            : (res.bonusXp > 0
              ? `+${res.bonusXp} Daily Bonus + ${qXp} Problem XP`
              : (res.message || 'Challenge attempt logged')),
          attemptNumber: 1,
        })

        // Authoritative metrics refresh on challenge submission completion
        if (res.success) {
          await refreshUserMetrics()
        }

        if (effectiveUserId) {
          const stats = await QuestionService.getQuestionAttempts(question.id, effectiveUserId)
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

    // Synchronously update in-memory progress map so subsequent question transitions remember this
    progressMapRef.current[question.id] = {
      questionId: question.id,
      isSolved: correct || Boolean(progressMapRef.current[question.id]?.isSolved),
      isCorrect: correct,
      isBookmarked,
      selectedOption,
      attemptsCount: (progressMapRef.current[question.id]?.attemptsCount || 0) + 1,
      timeSpentSeconds: timeSpent,
      lastAttemptedAt: new Date().toISOString(),
    }

    try {
      const res = await QuestionService.submitAnswer(
        question.id,
        selectedOption,
        timeSpent,
        effectiveUserId
      )
      setXpResult({
        xpChange: res.xpChange,
        xpReason: res.xpReason,
        attemptNumber: res.attemptNumber,
      })

      // On completed submission, synchronize authoritative user metrics
      if (effectiveUserId) {
        await refreshUserMetrics()
      }

      // Refresh question-specific attempt statistics
      if (effectiveUserId) {
        const stats = await QuestionService.getQuestionAttempts(question.id, effectiveUserId)
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

    if (progressMapRef.current[question.id]) {
      progressMapRef.current[question.id].isBookmarked = newStatus
    } else {
      progressMapRef.current[question.id] = {
        questionId: question.id,
        isSolved: false,
        isCorrect: false,
        isBookmarked: newStatus,
        attemptsCount: 0,
        timeSpentSeconds: 0,
        lastAttemptedAt: new Date().toISOString(),
      }
    }

    try {
      await QuestionService.toggleBookmark(question.id, effectiveUserId)
    } catch (err) {
      console.warn('Bookmark toggle error:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Navigate to Next Question in Pool (0ms instant transition via in-memory list)
  // ---------------------------------------------------------------------------
  const handleNextQuestion = () => {
    const list = catalogRef.current.length > 0 ? catalogRef.current : allQuestions
    if (!question || list.length === 0) {
      navigate('/questions')
      return
    }

    const currentIndex = list.findIndex((q) => q.id === question.id)
    const nextIndex = (currentIndex + 1) % list.length
    const nextQ = list[nextIndex]

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
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-[#0c1d2d] rounded-full animate-spin mb-3" />
        <div className="text-sm font-semibold text-slate-600">
          Loading problem...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5 animate-entry">
        {/* ================================================= */}
        {/* TOP BAR / NAVIGATION                              */}
        {/* ================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#0c1d2d]/10">
          <Link
            to="/questions"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#0c1d2d]/15 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Back to Problem Directory</span>
          </Link>

          <div className="flex items-center gap-2.5">
            {/* Stopwatch HUD */}
            <div
              className={`
                px-3 py-1.5 border rounded-lg font-mono font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm
                ${timerActive && !isSubmitted ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white border-[#0c1d2d]/15 text-slate-700'}
              `}
            >
              <Timer className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatTimer(timeSpent)}</span>
            </div>

            {/* Bookmark Button */}
            <button
              type="button"
              onClick={handleToggleBookmark}
              aria-label={isBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
              className={`
                p-2 border rounded-lg shadow-sm transition-colors cursor-pointer
                ${isBookmarked ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-white hover:bg-slate-50 border-[#0c1d2d]/15 text-slate-600'}
              `}
            >
              <Bookmark
                className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : 'text-slate-600'}`}
              />
            </button>
          </div>
        </div>

        {/* ================================================= */}
        {/* DAILY CHALLENGE BANNER                            */}
        {/* ================================================= */}
        {isChallengeMode && (
          <div className="bg-gradient-to-r from-amber-50 via-amber-50/60 to-white border border-amber-200/80 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 animate-entry">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0c1d2d] flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-[#ffd43b] fill-[#ffd43b]" />
              </div>
              <div>
                <div className="font-bold text-sm text-slate-900 leading-tight">
                  Daily Challenge Arena
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  Authoritative daily problem. First correct solve unlocks +50 Bonus XP & extends your streak.
                </div>
              </div>
            </div>
            <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-md px-2.5 py-1 font-mono text-xs font-bold shadow-xs">
              +50 Bonus XP
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* TWO-COLUMN QUESTION + OPTIONS ARENA               */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* =============================================== */}
          {/* 1. LEFT COLUMN: QUESTION CARD (~60% width)      */}
          {/* =============================================== */}
          <div className="order-1 lg:order-1 lg:col-span-7 flex flex-col">
            <div className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-sm p-6 sm:p-7">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <NeoBadge variant="dark" density="xs">
                  {question.category}
                </NeoBadge>
                <NeoBadge variant="outline" density="xs">
                  {question.topic}
                </NeoBadge>
                <StatusBadge status={question.difficulty} density="xs" />

                <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200/70 rounded-md font-mono font-bold text-xs text-amber-900">
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                  <span>{question.points} XP</span>
                </div>
              </div>

              <h1 className="font-bold text-xl sm:text-2xl text-slate-900 tracking-tight leading-tight">
                {question.title}
              </h1>

              <div className="mt-4 pt-4 border-t border-slate-100 font-normal text-base text-slate-800 leading-relaxed whitespace-pre-line break-words">
                {question.prompt}
              </div>
            </div>
          </div>

          {/* =============================================== */}
          {/* 2. RIGHT COLUMN: OPTIONS CARD (~40% width)      */}
          {/* =============================================== */}
          <section
            aria-label="Options"
            className="order-2 lg:order-2 lg:col-span-5 bg-white border border-[#0c1d2d]/12 rounded-xl shadow-sm p-6 sm:p-7 flex flex-col justify-between"
          >
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3.5">
                Select Your Answer:
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {question.options.map((opt) => {
                  const isSelected = selectedOption === opt.id
                  const effectiveCorrect = authoritativeCorrectOption || question.correctOption
                  const isCorrectOption = opt.id === effectiveCorrect

                  let cardStyle = 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70'

                  if (isSubmitted) {
                    if (isCorrectOption) {
                      cardStyle = 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    } else if (isSelected && !isCorrectOption) {
                      cardStyle = 'bg-rose-50/90 border-rose-300 text-rose-950'
                    } else {
                      cardStyle = 'bg-slate-50/60 border-slate-200 opacity-60'
                    }
                  } else if (isSelected) {
                    cardStyle = 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400/60 text-slate-900'
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isSubmitted}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedOption(opt.id)}
                      className={`
                        p-3 sm:p-3.5 rounded-xl border ${cardStyle}
                        flex items-center justify-between text-left transition-colors cursor-pointer
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`
                            w-7 h-7 rounded-md border flex items-center justify-center font-mono font-bold text-xs shrink-0
                            ${isSelected ? 'bg-[#0c1d2d] text-white border-[#0c1d2d]' : 'bg-slate-100 text-slate-700 border-slate-200'}
                          `}
                        >
                          {opt.id}
                        </span>
                        <span className="font-medium text-sm text-slate-900 leading-snug">
                          {opt.text}
                        </span>
                      </div>

                      {isSubmitted && isCorrectOption && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      )}
                      {isSubmitted && isSelected && !isCorrectOption && (
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* =============================================== */}
          {/* 3. HINT & SCRATCHPAD CONTROLS & DRAWERS         */}
          {/* (Desktop: Col 1-7, Mobile: order-3)             */}
          {/* =============================================== */}
          <div className="order-3 lg:order-3 lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
                  showHint ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-white hover:bg-slate-50 border-[#0c1d2d]/15 text-slate-700'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>{showHint ? 'Hide Hint' : 'Need a Hint?'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowScratchpad(!showScratchpad)}
                className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs ${
                  showScratchpad ? 'bg-sky-50 border-sky-300 text-sky-900' : 'bg-white hover:bg-slate-50 border-[#0c1d2d]/15 text-slate-700'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Scratchpad</span>
              </button>
            </div>

            {/* Hint Drawer */}
            {showHint && question.hints && question.hints.length > 0 && (
              <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl shadow-xs animate-entry">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-900 mb-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Problem Hints:</span>
                </div>
                <ul className="space-y-1 list-disc list-inside font-normal text-xs sm:text-sm text-slate-800 leading-relaxed">
                  {question.hints.map((hintText, idx) => (
                    <li key={idx}>{hintText}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Scratchpad Drawer */}
            {showScratchpad && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-xs animate-entry">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200">
                  <span className="font-semibold text-xs text-slate-800">
                    Rough Calculation Scratchpad
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    Persisted in current session only
                  </span>
                </div>
                <textarea
                  value={scratchpadNotes}
                  onChange={(e) => setScratchpadNotes(e.target.value)}
                  placeholder="Jot down rough calculations, formulas, or step-by-step logic here..."
                  rows={4}
                  className="w-full p-3 bg-white border border-slate-200 rounded-lg font-mono text-xs text-slate-800 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400"
                />
              </div>
            )}
          </div>

          {/* =============================================== */}
          {/* 4. SUBMIT / NEXT PROBLEM ACTION                 */}
          {/* (Desktop: Col 8-12, Mobile: order-4)            */}
          {/* =============================================== */}
          <div className="order-4 lg:order-4 lg:col-span-5">
            {!isSubmitted ? (
              <button
                type="button"
                onClick={handleSubmitAnswer}
                disabled={!selectedOption || isSubmitting}
                className="w-full py-3 px-6 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-xl shadow-xs font-bold text-sm tracking-wide transition-all active:scale-[0.99] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>{isSubmitting ? 'Verifying Solution...' : 'Submit Answer'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2.5">
                {/* Re-attempt button: Only show for normal practice questions OR if daily challenge attempt was incorrect */}
                {(!isChallengeMode || !isCorrect) && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubmitted(false)
                      setIsCorrect(null)
                      setSelectedOption(null)
                      setTimerActive(true)
                    }}
                    className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Re-attempt</span>
                  </button>
                )}

                {isChallengeMode ? (
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className="flex-1 py-2.5 px-4 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-xl font-bold text-xs sm:text-sm tracking-wide shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>Return to Dashboard</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="flex-1 py-2.5 px-4 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-xl font-bold text-xs sm:text-sm tracking-wide shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>Next Problem</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* =============================================== */}
          {/* 5. EXPLANATION & SUMMARY (AFTER SUBMIT)         */}
          {/* (Desktop: Col 1-12 full width, Mobile: order-5) */}
          {/* =============================================== */}
          {isSubmitted && (
            <div
              className={`
                order-5 lg:order-5 lg:col-span-12 p-5 sm:p-6 border rounded-xl shadow-sm animate-entry
                ${isCorrect ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'}
              `}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3.5 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold text-base text-emerald-950">
                          {xpResult && xpResult.xpChange === 0
                            ? 'Correct Reattempt! (+0 XP — Already Earned)'
                            : `Correct Solution! +${xpResult?.xpChange ?? question.points} XP Earned`}
                        </span>
                        {xpResult?.xpReason && (
                          <div className="font-mono text-xs text-emerald-800">
                            {xpResult.xpReason}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                      <div>
                        <span className="font-bold text-base text-rose-950">
                          Incorrect Attempt • {xpResult?.xpChange ?? -Math.max(1, Math.round(question.points * 0.25))} XP Penalty
                        </span>
                        <div className="font-mono text-xs text-rose-800">
                          Correct Answer is Option {authoritativeCorrectOption || question.correctOption}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Question-Specific Attempt Breakdown */}
                <div className="flex items-center gap-2.5">
                  {questionAttemptStats && (
                    <div className="flex items-center gap-2 font-mono text-xs bg-white px-2.5 py-1 border border-slate-200 rounded-md shadow-xs">
                      <span className="text-slate-600">Attempts: {questionAttemptStats.totalAttempts}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-emerald-600 font-semibold">Correct: {questionAttemptStats.correctCount}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-rose-600 font-semibold">Incorrect: {questionAttemptStats.incorrectCount}</span>
                    </div>
                  )}
                  <div className="font-mono text-xs font-semibold text-slate-600">
                    Solve Time: {formatTimer(timeSpent)}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-200/80 rounded-xl font-normal text-xs sm:text-sm text-slate-800 leading-relaxed">
                <div className="font-bold text-xs uppercase tracking-wider text-slate-700 mb-1.5">
                  Step-by-Step Mathematical Solution:
                </div>
                <div className="whitespace-pre-line">{authoritativeExplanation || question.explanation}</div>

                {question.formulaOrRule && (
                  <div className="mt-3 p-2.5 bg-amber-50/60 border border-amber-200/60 rounded-md font-mono text-xs font-medium text-amber-950 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Formula / Key Principle: {question.formulaOrRule}</span>
                  </div>
                )}
              </div>

              {/* Question Tags */}
              {question.tags && question.tags.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  {question.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600 font-mono text-[11px]"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
  )
}

