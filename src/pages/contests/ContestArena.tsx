import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Send,
  Loader2,
  XCircle,
  RotateCcw,
} from 'lucide-react'
import { ContestService } from '../../services/contestService'
import type { Contest, ContestQuestion, ContestSubmissionAnswer } from '../../types/contests'
import { supabase } from '../../lib/supabase'
import { useUserSession } from '../../contexts/UserSessionContext'

export default function ContestArena() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { refreshUserMetrics } = useUserSession()

  // State
  const [contest, setContest] = useState<Contest | null>(null)
  const [questions, setQuestions] = useState<ContestQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [questionTimeMap, setQuestionTimeMap] = useState<Record<string, number>>({})

  // Session & Timer State
  const [loading, setLoading] = useState(true)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const timerRef = useRef<number | null>(null)

  // ---------------------------------------------------------------------------
  // 1. Initialize Contest Session & Fetch Questions
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    const initArena = async () => {
      if (!id) return
      setLoading(true)
      setErrorMessage(null)

      try {
        // 1. Auth check
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          navigate('/login', { state: { from: `/contests/${id}/arena` } })
          return
        }

        // 2. Fetch contest info
        const c = await ContestService.getContestById(id)
        if (!c) {
          if (isMounted) setErrorMessage('Contest not found.')
          return
        }

        if (isMounted) setContest(c)

        // 3. Start or resume contest session via secure RPC
        const sessionRes = await ContestService.startContestSession(id)

        if (!sessionRes.success) {
          if (sessionRes.error === 'ALREADY_COMPLETED') {
            navigate(`/contests/${id}/results`, { replace: true })
            return
          }
          if (sessionRes.error === 'NOT_REGISTERED') {
            navigate(`/contests/${id}`, { replace: true })
            return
          }
          if (isMounted) {
            setErrorMessage(sessionRes.message || 'Could not start arena session.')
          }
          return
        }

        const session = sessionRes.session
        if (session) {
          if (isMounted) {
            setTimeRemaining(session.timeRemainingSeconds)
          }
        }

        // 4. Fetch questions (sanitized: no correct_option or explanation)
        const qRes = await ContestService.getContestQuestions(id)
        if (!qRes.success || qRes.questions.length === 0) {
          if (isMounted) {
            setErrorMessage(qRes.error || 'No questions available for this contest.')
          }
          return
        }

        if (isMounted) {
          setQuestions(qRes.questions)
        }
      } catch (err) {
        console.error('Arena initialization error:', err)
        if (isMounted) setErrorMessage('Failed to initialize contest arena.')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initArena()

    return () => {
      isMounted = false
    }
  }, [id, navigate])

  // ---------------------------------------------------------------------------
  // 2. Final Submit Handler (Server-Authoritative Evaluation)
  // ---------------------------------------------------------------------------
  const handleSubmitContest = useCallback(async () => {
    if (!id || isSubmitting) return
    setIsSubmitting(true)
    setShowSubmitModal(false)

    try {
      // Build clean answer payload
      const submissionPayload: ContestSubmissionAnswer[] = questions.map((q) => ({
        question_id: q.questionId,
        selected_option: answers[q.questionId] || null,
        time_spent_seconds: questionTimeMap[q.questionId] || 0,
      }))

      const result = await ContestService.submitContestAnswers(id, submissionPayload)

      if (result.success || result.alreadySubmitted) {
        await refreshUserMetrics().catch(() => {})
        navigate(`/contests/${id}/results`, { replace: true })
      } else {
        alert(result.error || result.message || 'Error submitting contest answers.')
        setIsSubmitting(false)
      }
    } catch (err) {
      console.error('Contest submission failure:', err)
      alert('Network error while submitting contest.')
      setIsSubmitting(false)
    }
  }, [id, isSubmitting, questions, answers, questionTimeMap, navigate, refreshUserMetrics])

  // ---------------------------------------------------------------------------
  // 3. Server-Synchronized Countdown Timer & Per-Question Time Tracking
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (timeRemaining === null || isSubmitting) return

    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          // Auto-submit when server-allotted duration runs out
          handleSubmitContest()
          return 0
        }
        return prev - 1
      })

      // Track time on current question
      if (questions.length > 0) {
        const currentQ = questions[currentIndex]
        if (currentQ) {
          setQuestionTimeMap((prev) => ({
            ...prev,
            [currentQ.questionId]: (prev[currentQ.questionId] || 0) + 1,
          }))
        }
      }
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timeRemaining, isSubmitting, questions, currentIndex, handleSubmitContest])

  // ---------------------------------------------------------------------------
  // 4. Option Selection
  // ---------------------------------------------------------------------------
  const handleSelectOption = (optionId: string) => {
    const currentQ = questions[currentIndex]
    if (!currentQ) return

    setAnswers((prev) => {
      // If already selected, allow toggling off or reselecting
      if (prev[currentQ.questionId] === optionId) {
        const copy = { ...prev }
        delete copy[currentQ.questionId]
        return copy
      }
      return { ...prev, [currentQ.questionId]: optionId }
    })
  }

  const handleClearSelection = () => {
    const currentQ = questions[currentIndex]
    if (!currentQ) return
    setAnswers((prev) => {
      const copy = { ...prev }
      delete copy[currentQ.questionId]
      return copy
    })
  }

  // Formatting seconds to MM:SS or HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    if (m >= 60) {
      const h = Math.floor(m / 60)
      const remM = m % 60
      return `${h}:${remM < 10 ? '0' : ''}${remM}:${s < 10 ? '0' : ''}${s}`
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c1d2d] flex items-center justify-center text-white px-4">
        <div className="text-center font-display font-black">
          <Loader2 className="w-12 h-12 border-2 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl uppercase tracking-wider text-[#ffd43b]">
            SYNCING TOURNAMENT ARENA...
          </h2>
          <p className="font-mono text-xs text-white/60 mt-1 uppercase">
            Establishing secure server session & loading questions
          </p>
        </div>
      </div>
    )
  }

  if (errorMessage || !contest || questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0c1d2d] flex items-center justify-center text-white px-4">
        <div className="bg-white text-black border-2 border-[#0c1d2d] rounded-xl p-6 sm:p-8 max-w-md w-full shadow-[8px_8px_0_#ff5b5b] text-center">
          <XCircle className="w-12 h-12 text-[#ff5b5b] mx-auto mb-3" />
          <h2 className="font-display font-black text-xl uppercase">ARENA ACCESS DENIED</h2>
          <p className="text-xs font-body font-semibold text-black/70 mt-2">
            {errorMessage || 'Unable to load contest questions.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/contests')}
            className="mt-6 w-full py-3 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#0c1d2d]"
          >
            RETURN TO TOURNAMENTS
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const attemptedCount = Object.keys(answers).length
  const isTimeCritical = timeRemaining !== null && timeRemaining <= 120 // less than 2 mins

  return (
    <div className="min-h-screen bg-[#0c1d2d] text-slate-900 arena-bg-grid flex flex-col">
      {/* =================================================== */}
      {/* 1. TOP SYNCHRONIZED ARENA HEADER                     */}
      {/* =================================================== */}
      <header className="bg-[#0c1d2d] border-b border-slate-800 sticky top-0 z-30 px-3 sm:px-6 py-2.5 shadow-sm text-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Contest info */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase">
                  Tournament Arena
                </span>
                <span className="font-semibold text-xs sm:text-sm text-white truncate max-w-[160px] sm:max-w-xs md:max-w-md">
                  {contest.title}
                </span>
              </div>
            </div>
          </div>

          {/* Central Live Timer */}
          <div className="flex items-center gap-2.5">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 border rounded-lg font-mono font-bold text-xs sm:text-sm shadow-xs transition-colors ${
                isTimeCritical
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-white/10 border-white/20 text-amber-300'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}</span>
            </div>

            <div className="hidden md:flex items-center gap-1 bg-white/10 border border-white/15 rounded-md px-2.5 py-1 font-mono text-xs text-slate-300">
              <span>{attemptedCount}/{questions.length} Attempted</span>
            </div>
          </div>

          {/* Finish & Submit Trigger */}
          <div>
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="px-3 sm:px-4 py-1.5 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-lg font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-[#0c1d2d]" />
              <span>Submit Contest</span>
            </button>
          </div>
        </div>
      </header>

      {/* =================================================== */}
      {/* 2. TWO-COLUMN MAIN ARENA                            */}
      {/* =================================================== */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-5 flex flex-col justify-between gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 sm:gap-5">
          {/* ================================================= */}
          {/* LEFT COLUMN: QUESTION CONTENT (60-65%)            */}
          {/* ================================================= */}
          <div className="bg-white border border-[#0c1d2d]/15 rounded-xl shadow-sm p-5 sm:p-7 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Question metadata strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="bg-slate-100 text-slate-800 border border-slate-200 rounded-md px-2.5 py-0.5 font-mono font-bold text-xs">
                    Question {String(currentIndex + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
                  </span>
                  <span className="bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 font-mono text-[11px] text-slate-600">
                    {currentQuestion.category}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs font-semibold">
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded px-2 py-0.5">
                    +{currentQuestion.marks} Marks
                  </span>
                  <span className="bg-rose-50 text-rose-800 border border-rose-200/80 rounded px-2 py-0.5">
                    -{currentQuestion.negativeMarks} Marks
                  </span>
                </div>
              </div>

              {/* Title & Prompt */}
              <div>
                <h2 className="font-bold text-lg sm:text-xl text-slate-900 leading-snug">
                  {currentQuestion.title}
                </h2>
                <div className="mt-0.5 font-mono text-[11px] text-slate-400 uppercase tracking-wider">
                  Topic: {currentQuestion.topic}
                </div>
              </div>

              <div className="p-4 sm:p-5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm sm:text-base font-normal text-slate-800 leading-relaxed whitespace-pre-line">
                {currentQuestion.prompt}
              </div>
            </div>

            {/* Bottom Question Controls */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white border border-slate-200 rounded-lg font-semibold text-xs text-slate-700 shadow-xs flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-slate-500" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                className="px-3 py-2 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg font-semibold text-xs text-slate-600 hover:text-rose-700 shadow-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Clear</span>
              </button>

              <button
                type="button"
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-4 py-2 bg-[#ffd43b] hover:bg-[#facb15] disabled:opacity-40 disabled:hover:bg-[#ffd43b] border border-amber-400/80 rounded-lg font-bold text-xs text-[#0c1d2d] shadow-xs flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ================================================= */}
          {/* RIGHT COLUMN: OPTIONS + QUESTION NAVIGATOR (35-40%)*/}
          {/* ================================================= */}
          <div className="space-y-4 flex flex-col justify-between">
            {/* Options Deck */}
            <div className="bg-white border border-[#0c1d2d]/15 rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                <span className="font-semibold text-xs text-slate-500 uppercase tracking-wider">
                  Select Answer
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  Single Choice
                </span>
              </div>

              <div className="space-y-2">
                {currentQuestion.options.map((option) => {
                  const isSelected = answers[currentQuestion.questionId] === option.id

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelectOption(option.id)}
                      className={`w-full text-left p-3 sm:p-3.5 rounded-xl border text-xs sm:text-sm flex items-start gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-400/60 text-slate-900 font-semibold'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 font-medium'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-md border flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-[#0c1d2d] text-white border-[#0c1d2d]' : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {option.id}
                      </span>
                      <span className="mt-0.5 leading-snug">{option.text}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Question Navigator Grid */}
            <div className="bg-white border border-[#0c1d2d]/15 rounded-xl shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                <span className="font-semibold text-xs text-slate-700">
                  Problem Navigator
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  {attemptedCount} of {questions.length} Attempted
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex
                  const isAnswered = !!answers[q.questionId]

                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`h-8 border rounded-lg font-mono text-xs flex items-center justify-center cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-amber-100 border-amber-400 text-amber-950 font-bold ring-1 ring-amber-400'
                          : isAnswered
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  )
                })}
              </div>

              {/* Status Legend */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-center gap-4 text-[10px] font-mono text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-emerald-500" />
                  <span>Attempted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-slate-300" />
                  <span>Unattempted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-amber-400 ring-1 ring-amber-400" />
                  <span>Current</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* =================================================== */}
      {/* 3. CONFIRMATION SUBMIT MODAL                        */}
      {/* =================================================== */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-xl animate-in fade-in zoom-in-95">
            <div className="w-11 h-11 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto mb-3 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <h3 className="font-bold text-lg text-slate-900 text-center">
              Finish & Submit Contest?
            </h3>

            <p className="text-xs text-slate-600 text-center mt-1.5 leading-relaxed">
              Once submitted, your answers are graded server-side and your final rank is calculated. You cannot return to the arena.
            </p>

            {/* Submission Stat Breakdown */}
            <div className="my-4 grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
              <div>
                <div className="font-mono text-[10px] font-semibold text-slate-500 uppercase">
                  Attempted
                </div>
                <div className="font-bold text-base text-emerald-700 mt-0.5">
                  {attemptedCount} / {questions.length}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] font-semibold text-slate-500 uppercase">
                  Time Remaining
                </div>
                <div className="font-bold text-base text-slate-900 mt-0.5">
                  {timeRemaining !== null ? formatTime(timeRemaining) : '0:00'}
                </div>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg font-semibold text-xs shadow-xs cursor-pointer transition-colors"
              >
                Continue Solving
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitContest}
                className="flex-1 py-2 px-3 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-lg font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#0c1d2d]" />
                    <span>Confirm & Submit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
