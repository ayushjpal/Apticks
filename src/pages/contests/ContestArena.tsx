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

export default function ContestArena() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

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
  }, [id, isSubmitting, questions, answers, questionTimeMap, navigate])

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
      <div className="min-h-screen bg-[#071a2b] flex items-center justify-center text-white px-4">
        <div className="text-center font-display font-black">
          <Loader2 className="w-12 h-12 border-3 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-4" />
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
      <div className="min-h-screen bg-[#071a2b] flex items-center justify-center text-white px-4">
        <div className="bg-white text-black border-4 border-black rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-[8px_8px_0_#ff5b5b] text-center">
          <XCircle className="w-12 h-12 text-[#ff5b5b] mx-auto mb-3" />
          <h2 className="font-display font-black text-xl uppercase">ARENA ACCESS DENIED</h2>
          <p className="text-xs font-body font-semibold text-black/70 mt-2">
            {errorMessage || 'Unable to load contest questions.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/contests')}
            className="mt-6 w-full py-3 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000]"
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
    <div className="min-h-screen bg-[#071a2b] text-black arena-bg-grid flex flex-col">
      {/* =================================================== */}
      {/* 1. TOP SYNCHRONIZED ARENA HEADER                     */}
      {/* =================================================== */}
      <header className="bg-white border-b-3 border-black sticky top-0 z-30 px-3 sm:px-6 py-2.5 shadow-[0_4px_0_#000000]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Contest info */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5b5b] border border-black animate-pulse shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="bg-black text-[#ffd43b] px-1.5 py-0.2 rounded font-mono text-[9px] font-black uppercase">
                  ARENA
                </span>
                <span className="font-display font-black text-xs sm:text-sm uppercase tracking-tight text-black truncate max-w-[160px] sm:max-w-xs md:max-w-md">
                  {contest.title}
                </span>
              </div>
            </div>
          </div>

          {/* Central Live Timer */}
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 border-2 border-black rounded-xl font-mono font-black text-xs sm:text-sm shadow-[2px_2px_0_#000000] transition-colors ${
                isTimeCritical
                  ? 'bg-[#ff5b5b] text-white animate-pulse'
                  : 'bg-[#ffd43b] text-black'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}</span>
            </div>

            <div className="hidden md:flex items-center gap-1 bg-[#f8fafc] border-1.5 border-black rounded-lg px-2 py-1 font-mono text-[10px] font-bold text-black/70">
              <span>{attemptedCount}/{questions.length} ATTEMPTED</span>
            </div>
          </div>

          {/* Finish & Submit Trigger */}
          <div>
            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="px-3 sm:px-5 py-1.5 sm:py-2 bg-[#32e875] hover:bg-[#22c55e] text-black border-2 border-black rounded-xl font-display font-black text-[11px] sm:text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center gap-1.5 transition-transform hover:-translate-x-0.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>SUBMIT CONTEST</span>
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
          <div className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] p-5 sm:p-7 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Question metadata strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-2 border-black">
                <div className="flex items-center gap-2">
                  <span className="bg-[#ffd43b] text-black border-1.5 border-black rounded-lg px-2.5 py-0.5 font-mono font-black text-xs uppercase shadow-[1.5px_1.5px_0_#000000]">
                    QUESTION {String(currentIndex + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
                  </span>
                  <span className="bg-[#f1f5f9] border border-black rounded-md px-2 py-0.5 font-mono text-[10px] font-bold text-black/70">
                    {currentQuestion.category}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs font-black">
                  <span className="bg-[#dcfce7] text-[#166534] border border-black rounded-md px-2 py-0.5">
                    +{currentQuestion.marks} MARKS
                  </span>
                  <span className="bg-[#fee2e2] text-[#991b1b] border border-black rounded-md px-2 py-0.5">
                    -{currentQuestion.negativeMarks} MARKS
                  </span>
                </div>
              </div>

              {/* Title & Prompt */}
              <div>
                <h2 className="font-display font-black text-lg sm:text-xl uppercase text-black leading-tight">
                  {currentQuestion.title}
                </h2>
                <div className="mt-1 font-mono text-[10px] font-bold text-black/50 uppercase">
                  TOPIC: {currentQuestion.topic}
                </div>
              </div>

              <div className="p-4 sm:p-5 bg-[#faf9f6] border-2 border-black rounded-xl shadow-[2px_2px_0_#000000] text-sm sm:text-base font-body font-semibold text-black leading-relaxed whitespace-pre-line">
                {currentQuestion.prompt}
              </div>
            </div>

            {/* Bottom Question Controls */}
            <div className="mt-6 pt-4 border-t-2 border-black flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="px-3 sm:px-4 py-2 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>PREV</span>
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                className="px-3 py-2 bg-white hover:bg-[#fee2e2] border-2 border-black rounded-xl font-display font-bold text-[11px] uppercase shadow-[1.5px_1.5px_0_#000000] flex items-center gap-1 text-black/75 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>CLEAR</span>
              </button>

              <button
                type="button"
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-3 sm:px-4 py-2 bg-[#ffd43b] hover:bg-[#facc15] disabled:opacity-40 disabled:hover:bg-[#ffd43b] border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <span>NEXT</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ================================================= */}
          {/* RIGHT COLUMN: OPTIONS + QUESTION NAVIGATOR (35-40%)*/}
          {/* ================================================= */}
          <div className="space-y-4 flex flex-col justify-between">
            {/* Options Deck */}
            <div className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] p-4 sm:p-6">
              <div className="flex items-center justify-between pb-2.5 mb-3 border-b-2 border-black">
                <span className="font-display font-black text-xs uppercase text-black">
                  SELECT YOUR ANSWER
                </span>
                <span className="font-mono text-[10px] font-bold text-black/60">
                  SINGLE CHOICE
                </span>
              </div>

              <div className="space-y-2.5">
                {currentQuestion.options.map((option) => {
                  const isSelected = answers[currentQuestion.questionId] === option.id

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSelectOption(option.id)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 sm:border-3 border-black font-body font-bold text-xs sm:text-sm flex items-start gap-3 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#ffd43b] shadow-[3px_3px_0_#000000] -translate-y-0.5'
                          : 'bg-white hover:bg-[#e9f6ff] shadow-[2px_2px_0_#000000]'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-lg border-2 border-black flex items-center justify-center font-mono font-black text-xs shrink-0 ${
                          isSelected ? 'bg-black text-white' : 'bg-[#f1f5f9] text-black'
                        }`}
                      >
                        {option.id}
                      </span>
                      <span className="mt-0.5 text-black leading-snug">{option.text}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Question Navigator Grid */}
            <div className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] p-4 sm:p-5">
              <div className="flex items-center justify-between pb-2 mb-3 border-b-2 border-black">
                <span className="font-display font-black text-xs uppercase text-black">
                  QUESTION NAVIGATOR
                </span>
                <span className="font-mono text-[10px] font-bold text-black/60">
                  {attemptedCount} of {questions.length} Solved
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
                      className={`h-9 border-2 border-black rounded-lg font-mono font-black text-xs flex items-center justify-center cursor-pointer transition-all ${
                        isCurrent
                          ? 'ring-3 ring-black bg-[#ffd43b] text-black scale-105 shadow-[2px_2px_0_#000000]'
                          : isAnswered
                          ? 'bg-[#32e875] text-black hover:bg-[#22c55e]'
                          : 'bg-[#f8fafc] text-black/70 hover:bg-slate-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  )
                })}
              </div>

              {/* Status Legend */}
              <div className="mt-3 pt-2.5 border-t border-black/10 flex items-center justify-center gap-4 text-[10px] font-mono font-bold text-black/70">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#32e875] border border-black" />
                  <span>Attempted</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#f8fafc] border border-black" />
                  <span>Unattempted</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-[#ffd43b] border border-black ring-1 ring-black" />
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-[8px_8px_0_#000000] animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 bg-[#ffd43b] border-2 border-black rounded-xl flex items-center justify-center mx-auto mb-3 shadow-[2px_2px_0_#000000]">
              <AlertTriangle className="w-6 h-6 text-black" />
            </div>

            <h3 className="font-display font-black text-xl uppercase text-black text-center">
              FINISH & SUBMIT CONTEST?
            </h3>

            <p className="text-xs font-body font-semibold text-black/70 text-center mt-1.5 leading-relaxed">
              Once submitted, your answers are graded server-side and your final rank is calculated. You cannot return to the arena.
            </p>

            {/* Submission Stat Breakdown */}
            <div className="my-5 grid grid-cols-2 gap-3 p-3 bg-[#f8fafc] border-2 border-black rounded-xl text-center">
              <div>
                <div className="font-mono text-[10px] font-bold text-black/60 uppercase">
                  ATTEMPTED
                </div>
                <div className="font-display font-black text-lg text-[#166534]">
                  {attemptedCount} / {questions.length}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold text-black/60 uppercase">
                  TIME REMAINING
                </div>
                <div className="font-display font-black text-lg text-black">
                  {timeRemaining !== null ? formatTime(timeRemaining) : '0:00'}
                </div>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 bg-white hover:bg-slate-100 border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] cursor-pointer"
              >
                CONTINUE SOLVING
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitContest}
                className="flex-1 py-2.5 bg-[#32e875] hover:bg-[#22c55e] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>CONFIRM SUBMIT</span>
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
