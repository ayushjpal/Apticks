import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  Bookmark,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Edit3,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { QuestionService } from '../../services/questionService'
import { INITIAL_QUESTIONS } from '../../data/questionsData'
import type { Question } from '../../types/questions'
import AppLayout from '../../components/layout/AppLayout'

export default function QuestionSolver() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [userId, setUserId] = useState<string | undefined>()
  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)

  // Solver State
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [timeSpent, setTimeSpent] = useState(0)
  const [timerActive, setTimerActive] = useState(true)

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

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user && isMounted) {
          setUserId(user.id)
        }

        const foundQuestion = INITIAL_QUESTIONS.find((q) => q.id === id)
        if (!foundQuestion) {
          navigate('/questions', { replace: true })
          return
        }

        if (isMounted) {
          setQuestion(foundQuestion)
        }

        if (user?.id) {
          const { progressMap } = await QuestionService.getQuestionsWithProgress(user.id)
          const p = progressMap[id]
          if (isMounted && p) {
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
  }, [id, navigate])

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
  // 3. Submit Answer
  // ---------------------------------------------------------------------------
  const handleSubmitAnswer = async () => {
    if (!selectedOption || !question || isSubmitted) return

    setTimerActive(false)
    setIsSubmitted(true)

    const correct = selectedOption === question.correctOption
    setIsCorrect(correct)

    try {
      await QuestionService.submitAnswer(
        question.id,
        selectedOption,
        timeSpent,
        userId
      )
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
    await QuestionService.toggleBookmark(question.id, userId)
  }

  // ---------------------------------------------------------------------------
  // 5. Navigate Next Question
  // ---------------------------------------------------------------------------
  const handleNextQuestion = () => {
    if (!question) return
    const currentIndex = INITIAL_QUESTIONS.findIndex((q) => q.id === question.id)
    if (currentIndex >= 0 && currentIndex < INITIAL_QUESTIONS.length - 1) {
      const nextQ = INITIAL_QUESTIONS[currentIndex + 1]
      navigate(`/questions/${nextQ.id}`)
    } else {
      navigate('/questions')
    }
  }

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading || !question) {
    return (
      <div className="min-h-screen bg-[#071a2b] flex items-center justify-center text-white">
        <div className="text-center font-display font-black">
          <div className="w-12 h-12 border-4 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-4" />
          <p className="tracking-wider">LOADING ARENA QUESTION...</p>
        </div>
      </div>
    )
  }

  const targetTime = 120
  const isTimeUrgent = timeSpent > targetTime - 20

  return (
    <AppLayout hideBottomNav={true}>
      <div className="max-w-4xl mx-auto space-y-5 animate-entry">
        {/* ================================================= */}
        {/* TOP SOLVER HUD BAR                                */}
        {/* ================================================= */}
        <div className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] p-4 sm:p-5 flex items-center justify-between gap-3">
          <Link
            to="/questions"
            className="px-3.5 py-2 bg-[#f1f5f9] hover:bg-[#e2e8f0] border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center gap-1.5 transition-transform hover:-translate-x-0.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">BACK TO BANK</span>
          </Link>

          {/* Stopwatch with Urgency state */}
          <div
            className={`
              flex items-center gap-2 px-4 py-1.5 border-2 border-black rounded-full shadow-[2px_2px_0_#000000] font-mono font-black text-sm sm:text-base
              ${
                isTimeUrgent && !isSubmitted
                  ? 'bg-[#ff5b5b] text-white animate-pulse'
                  : timeSpent > targetTime / 2
                  ? 'bg-[#ffd43b] text-black'
                  : 'bg-[#e9f6ff] text-[#071a2b]'
              }
            `}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>{formatTimer(timeSpent)}</span>
            <span className="text-[10px] font-bold opacity-75 hidden sm:inline">
              / {formatTimer(targetTime)} TARGET
            </span>
          </div>

          {/* Problem meta badges */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleBookmark}
              className={`p-2 border-2 border-black rounded-xl shadow-[2px_2px_0_#000000] transition-transform hover:scale-105 cursor-pointer ${
                isBookmarked ? 'bg-[#ffd43b] text-black' : 'bg-white text-black/60'
              }`}
              title={isBookmarked ? 'Saved' : 'Save for review'}
            >
              <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-black' : ''}`} />
            </button>

            <span className="hidden sm:inline-block bg-black text-white border-2 border-black rounded-xl px-3 py-2 font-mono font-black text-xs shadow-[2px_2px_0_#ffd43b]">
              +{question.points} XP
            </span>
          </div>
        </div>

        {/* ================================================= */}
        {/* QUESTION PROMPT CARD                              */}
        {/* ================================================= */}
        <section className="bg-white border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[8px_8px_0_#ffd43b] p-6 sm:p-8">
          {/* Metadata chips */}
          <div className="flex flex-wrap items-center gap-2 pb-4 mb-5 border-b-2 border-black">
            <span className="bg-[#38aef0] text-black border-2 border-black rounded-full px-3 py-0.5 text-[10px] font-mono font-black uppercase">
              {question.category}
            </span>
            <span className="bg-[#f1f5f9] text-black border-2 border-black rounded-full px-3 py-0.5 text-[10px] font-mono font-black uppercase">
              {question.topic}
            </span>
            <span
              className={`border-2 border-black rounded-full px-3 py-0.5 text-[10px] font-display font-black uppercase ${
                question.difficulty === 'easy'
                  ? 'bg-[#32e875] text-black'
                  : question.difficulty === 'medium'
                  ? 'bg-[#ffd43b] text-black'
                  : 'bg-[#ff5b5b] text-white'
              }`}
            >
              {question.difficulty}
            </span>
          </div>

          <h1 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-black leading-snug">
            {question.title}
          </h1>

          <div className="mt-4 p-5 bg-[#f8fafc] border-2 border-black rounded-xl font-body font-semibold text-sm sm:text-base text-black/90 leading-relaxed whitespace-pre-line">
            {question.prompt}
          </div>

          {/* =============================================== */}
          {/* OPTIONS LIST (A / B / C / D)                     */}
          {/* =============================================== */}
          <div className="mt-6 space-y-3">
            {question.options.map((opt) => {
              const isSelected = selectedOption === opt.id
              const isCorrectOption = question.correctOption === opt.id

              let stateStyle = 'bg-white hover:bg-[#f8fafc] border-black text-black'
              if (isSubmitted) {
                if (isCorrectOption) {
                  stateStyle = 'bg-[#d1fae5] border-black text-[#065f46] font-bold ring-2 ring-[#059669]'
                } else if (isSelected && !isCorrectOption) {
                  stateStyle = 'bg-[#fee2e2] border-black text-[#991b1b]'
                } else {
                  stateStyle = 'bg-slate-100 opacity-60 border-black/40 text-black'
                }
              } else if (isSelected) {
                stateStyle = 'bg-[#ffd43b] border-black text-black font-bold shadow-[4px_4px_0_#000000] -translate-y-0.5'
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isSubmitted}
                  onClick={() => setSelectedOption(opt.id)}
                  className={`
                    w-full p-4 border-2 sm:border-3 rounded-xl sm:rounded-2xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer select-none shadow-[3px_3px_0_#000000]
                    ${stateStyle}
                  `}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-mono font-black text-sm shrink-0">
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
                disabled={!selectedOption}
                className="px-7 py-3 bg-[#32e875] hover:bg-[#22c55e] border-2 sm:border-3 border-black rounded-xl shadow-[3.5px_3.5px_0_#000000] font-display font-black text-sm uppercase tracking-wider transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span>LOCK & SUBMIT ANSWER</span>
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

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="px-6 py-2.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 sm:border-3 border-black rounded-xl font-display font-black text-xs sm:text-sm uppercase tracking-wider shadow-[3px_3px_0_#000000] flex items-center gap-2 cursor-pointer transition-transform hover:-translate-x-0.5"
                >
                  <span>NEXT PROBLEM</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
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
        {/* EXPLANATION & ACCURACY SUMMARY (AFTER SUBMIT)     */}
        {/* ================================================= */}
        {isSubmitted && (
          <div
            className={`
              p-6 border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[6px_6px_0_#000000] animate-entry
              ${isCorrect ? 'bg-[#d1fae5]' : 'bg-[#fee2e2]'}
            `}
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
              <div className="flex items-center gap-2.5">
                {isCorrect ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-[#065f46]" />
                    <span className="font-display font-black text-lg uppercase text-[#065f46]">
                      CORRECT! +{question.points} XP EARNED
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-6 h-6 text-[#991b1b]" />
                    <span className="font-display font-black text-lg uppercase text-[#991b1b]">
                      INCORRECT ATTEMPT • CORRECT ANSWER IS OPTION {question.correctOption}
                    </span>
                  </>
                )}
              </div>

              <div className="font-mono text-xs font-black text-black">
                SOLVE TIME: {formatTimer(timeSpent)}
              </div>
            </div>

            <div className="p-4 bg-white border-2 border-black rounded-xl font-body font-semibold text-xs sm:text-sm text-black/85 leading-relaxed">
              <div className="font-display font-black text-xs uppercase text-black mb-1.5">
                STEP-BY-STEP SOLUTION:
              </div>
              {question.explanation}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
