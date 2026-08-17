import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { INITIAL_QUESTIONS } from '../../data/questionsData'
import { QuestionService } from '../../services/questionService'
import type { Question, UserQuestionProgress } from '../../types/questions'
import './QuestionSolver.css'

export default function QuestionSolver() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [userId, setUserId] = useState<string | undefined>()
  const [question, setQuestion] = useState<Question | null>(null)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Timer state
  const [seconds, setSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(true)

  // Interactive Tools state
  const [showHint, setShowHint] = useState(false)
  const [showScratchpad, setShowScratchpad] = useState(false)
  const [scratchpadText, setScratchpadText] = useState('')

  // -----------------------------------------
  // 1. Load User, Question & Prior Progress
  // -----------------------------------------
  useEffect(() => {
    let isMounted = true

    const loadQuestionData = async () => {
      setLoading(true)
      setIsSubmitted(false)
      setIsCorrect(null)
      setSelectedOption(null)
      setShowHint(false)
      setSeconds(0)
      setTimerRunning(true)

      const targetQ = INITIAL_QUESTIONS.find((q) => q.id === id)
      if (!targetQ) {
        if (isMounted) {
          setLoading(false)
          setQuestion(null)
        }
        return
      }

      if (isMounted) setQuestion(targetQ)

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user && isMounted) {
          setUserId(user.id)
          const { progressMap } =
            await QuestionService.getQuestionsWithProgress(user.id)

          const prog: UserQuestionProgress | undefined = progressMap[targetQ.id]
          if (prog && isMounted) {
            setIsBookmarked(prog.isBookmarked)
            if (prog.isSolved || prog.attemptsCount > 0) {
              setSelectedOption(prog.selectedOption || null)
              setIsSubmitted(true)
              setIsCorrect(prog.isCorrect)
              setTimerRunning(false)
            }
          }
        }
      } catch (err) {
        console.error('Error fetching question solver progress:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadQuestionData()

    return () => {
      isMounted = false
    }
  }, [id])

  // -----------------------------------------
  // 2. Active Stopwatch Timer
  // -----------------------------------------
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null
    if (timerRunning) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1)
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timerRunning])

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`
  }

  // -----------------------------------------
  // 3. Navigation Index (Next / Prev)
  // -----------------------------------------
  const currentIndex = INITIAL_QUESTIONS.findIndex((q) => q.id === id)
  const prevQuestion =
    currentIndex > 0 ? INITIAL_QUESTIONS[currentIndex - 1] : null
  const nextQuestion =
    currentIndex < INITIAL_QUESTIONS.length - 1
      ? INITIAL_QUESTIONS[currentIndex + 1]
      : null

  // -----------------------------------------
  // 4. Action Handlers
  // -----------------------------------------
  const handleSelectOption = (optionId: string) => {
    if (isSubmitted && isCorrect) return // Prevent changing if already solved
    setSelectedOption(optionId)
  }

  const handleSubmit = async () => {
    if (!selectedOption || !question) return

    setSubmitting(true)
    setTimerRunning(false)

    try {
      const result = await QuestionService.submitAnswer(
        question.id,
        selectedOption,
        seconds,
        userId
      )

      setIsSubmitted(true)
      setIsCorrect(result.isCorrect)
    } catch (err) {
      console.error('Error submitting answer:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReattempt = () => {
    setIsSubmitted(false)
    setIsCorrect(null)
    setTimerRunning(true)
  }

  const handleToggleBookmark = async () => {
    if (!question) return
    const newStatus = !isBookmarked
    setIsBookmarked(newStatus)
    await QuestionService.toggleBookmark(question.id, userId)
  }

  if (loading) {
    return (
      <div className="qs-page flex items-center justify-center text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 border-4 border-white/20 border-t-[#ffd43b] rounded-full animate-spin" />
          <p className="font-black text-lg">LOADING PROBLEM ARENA...</p>
        </div>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="qs-page flex items-center justify-center">
        <div className="bg-white border-4 border-black p-8 text-center max-w-md shadow-[6px_6px_0_#000]">
          <h2 className="font-black text-2xl mb-2">QUESTION NOT FOUND</h2>
          <p className="font-bold text-black/60 mb-6">
            The requested aptitude problem does not exist in the question bank.
          </p>
          <button
            onClick={() => navigate('/questions')}
            className="px-6 py-3 bg-[#ffd43b] border-3 border-black font-black"
          >
            ← BACK TO QUESTION BANK
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="qs-page">
      {/* Background Grid */}
      <div className="qs-bg-grid" />

      <div className="qs-container">
        {/* ================================================= */}
        {/* TOP BAR / NAVIGATION                              */}
        {/* ================================================= */}
        <header className="qs-header">
          <button
            onClick={() => navigate('/questions')}
            className="qs-back-btn"
          >
            <span>←</span> ALL PROBLEMS
          </button>

          <div className="flex items-center gap-3">
            {/* Difficulty Badge */}
            {question.difficulty === 'easy' && (
              <span className="px-3 py-1 bg-[#32e875] border-2 border-black font-black text-xs shadow-[2px_2px_0_#000]">
                EASY
              </span>
            )}
            {question.difficulty === 'medium' && (
              <span className="px-3 py-1 bg-[#ffd43b] border-2 border-black font-black text-xs shadow-[2px_2px_0_#000]">
                MEDIUM
              </span>
            )}
            {question.difficulty === 'hard' && (
              <span className="px-3 py-1 bg-[#ff5b5b] text-white border-2 border-black font-black text-xs shadow-[2px_2px_0_#000]">
                HARD
              </span>
            )}

            {/* Timer */}
            <div className="qs-timer-pill">
              <span className="text-xs font-black text-white/60">TIME:</span>
              <span>{formatTimer(seconds)}</span>
            </div>

            {/* Bookmark Button */}
            <button
              onClick={handleToggleBookmark}
              className={`px-3 py-1.5 border-3 border-black font-black text-xs shadow-[2px_2px_0_#000] cursor-pointer transition-all ${
                isBookmarked
                  ? 'bg-[#ffd43b] text-black'
                  : 'bg-white text-black/60 hover:text-black'
              }`}
              title={
                isBookmarked ? 'Bookmarked for Revision' : 'Bookmark Question'
              }
            >
              {isBookmarked ? '[SAVED]' : '[+] SAVE'}
            </button>
          </div>
        </header>

        {/* ================================================= */}
        {/* MAIN PROBLEM BOX                                  */}
        {/* ================================================= */}
        <article className="qs-problem-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="qs-topic-badge">
              {question.category} // {question.topic}
            </span>
            <span className="text-xs font-black text-black/60">
              +{question.points} POINTS
            </span>
          </div>

          <h1 className="text-2xl lg:text-3xl font-black uppercase text-[#071a2b] tracking-tight">
            {question.title}
          </h1>

          {/* Problem Prompt */}
          <div className="qs-prompt-text">{question.prompt}</div>

          {/* 4 Interactive Option Tiles */}
          <div className="qs-options-grid">
            {question.options.map((opt) => {
              const isSelected = selectedOption === opt.id
              const isCorrectOption = opt.id === question.correctOption

              let tileClass = 'qs-option-tile'
              if (isSubmitted) {
                if (isCorrectOption) {
                  tileClass += ' correct'
                } else if (isSelected && !isCorrect) {
                  tileClass += ' incorrect'
                }
              } else if (isSelected) {
                tileClass += ' selected'
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectOption(opt.id)}
                  disabled={isSubmitted && (isCorrect ?? false)}
                  className={tileClass}
                >
                  <div className="qs-option-letter">{opt.id}</div>
                  <div className="qs-option-text">{opt.text}</div>
                </button>
              )
            })}
          </div>

          {/* Action Row */}
          <div className="qs-actions-bar">
            <div className="flex items-center gap-3">
              {/* Hint Button */}
              {question.hints && question.hints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHint(!showHint)}
                  className="qs-secondary-btn"
                >
                  {showHint ? 'HIDE HINT' : 'SHOW HINT'}
                </button>
              )}

              {/* Scratchpad Toggle */}
              <button
                type="button"
                onClick={() => setShowScratchpad(!showScratchpad)}
                className="qs-secondary-btn"
              >
                {showScratchpad ? 'CLOSE SCRATCHPAD' : 'SCRATCHPAD'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              {isSubmitted && !isCorrect && (
                <button
                  type="button"
                  onClick={handleReattempt}
                  className="qs-secondary-btn bg-[#fff3cd]"
                >
                  TRY AGAIN
                </button>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedOption || submitting || (isSubmitted && (isCorrect ?? false))}
                className="qs-submit-btn"
              >
                {submitting
                  ? 'CHECKING...'
                  : isSubmitted && isCorrect
                  ? 'COMPLETED'
                  : 'SUBMIT ANSWER →'}
              </button>
            </div>
          </div>

          {/* =============================================== */}
          {/* HINT DRAWER                                     */}
          {/* =============================================== */}
          {showHint && question.hints && (
            <div className="mt-5 p-4 bg-[#fff9db] border-3 border-black shadow-[3px_3px_0_#000]">
              <div className="font-black text-xs uppercase text-[#926002] mb-1">
                Progressive Hints:
              </div>
              <ul className="list-disc list-inside space-y-1 font-bold text-sm">
                {question.hints.map((h, idx) => (
                  <li key={idx}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {/* =============================================== */}
          {/* SCRATCHPAD DOODLE/CALCULATION NOTEPAD           */}
          {/* =============================================== */}
          {showScratchpad && (
            <div className="qs-scratchpad-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-xs uppercase">
                  Rough Calculation Pad (Scratchpad):
                </span>
                <button
                  onClick={() => setScratchpadText('')}
                  className="text-xs font-bold text-red-600 underline"
                >
                  Clear Notes
                </button>
              </div>
              <textarea
                value={scratchpadText}
                onChange={(e) => setScratchpadText(e.target.value)}
                placeholder="Type your intermediate calculations, equations, or rough notes here..."
                className="qs-scratchpad-textarea"
              />
            </div>
          )}

          {/* =============================================== */}
          {/* FEEDBACK BANNER                                 */}
          {/* =============================================== */}
          {isSubmitted && isCorrect && (
            <div className="qs-banner-correct">
              <div>
                <div className="font-black text-lg">
                  CORRECT ANSWER
                </div>
                <div className="text-sm font-bold text-black/80">
                  You earned +{question.points} Points in{' '}
                  {formatTimer(seconds)}.
                </div>
              </div>
              {nextQuestion && (
                <button
                  onClick={() => navigate(`/questions/${nextQuestion.id}`)}
                  className="px-5 py-2.5 bg-[#071a2b] text-white border-2 border-black font-black text-xs shadow-[3px_3px_0_#000] hover:bg-black"
                >
                  NEXT PROBLEM →
                </button>
              )}
            </div>
          )}

          {isSubmitted && !isCorrect && (
            <div className="qs-banner-incorrect">
              <div>
                <div className="font-black text-lg">
                  INCORRECT OPTION SELECTED
                </div>
                <div className="text-sm font-bold text-white/90">
                  Correct answer is Option ({question.correctOption}). Review
                  the detailed solution below.
                </div>
              </div>
            </div>
          )}

          {/* =============================================== */}
          {/* STEP-BY-STEP EXPLANATION DRAWER                 */}
          {/* =============================================== */}
          {isSubmitted && (
            <section className="qs-explanation-card">
              <div className="font-black text-xs uppercase tracking-widest text-[#38aef0] mb-1">
                DETAILED SOLUTION & METHOD
              </div>
              <h3 className="font-black text-xl mb-3">
                Step-by-Step Mathematical Explanation
              </h3>

              {question.formulaOrRule && (
                <div className="qs-formula-box">
                  <strong>Key Formula / Shortcut:</strong>
                  <div className="mt-1">{question.formulaOrRule}</div>
                </div>
              )}

              <div className="text-base font-bold leading-relaxed whitespace-pre-line text-slate-800">
                {question.explanation}
              </div>
            </section>
          )}
        </article>

        {/* ================================================= */}
        {/* FOOTER NAVIGATION (PREV / NEXT)                   */}
        {/* ================================================= */}
        <footer className="qs-footer-nav">
          {prevQuestion ? (
            <button
              onClick={() => navigate(`/questions/${prevQuestion.id}`)}
              className="px-5 py-3 bg-white border-3 border-black shadow-[4px_4px_0_#000] font-black text-sm hover:bg-[#e9f6ff] transition-all"
            >
              ← PREVIOUS PROBLEM
            </button>
          ) : (
            <div />
          )}

          {nextQuestion ? (
            <button
              onClick={() => navigate(`/questions/${nextQuestion.id}`)}
              className="px-5 py-3 bg-[#ffd43b] border-3 border-black shadow-[4px_4px_0_#000] font-black text-sm hover:bg-[#ffde6a] transition-all"
            >
              NEXT PROBLEM →
            </button>
          ) : (
            <button
              onClick={() => navigate('/questions')}
              className="px-5 py-3 bg-[#32e875] border-3 border-black shadow-[4px_4px_0_#000] font-black text-sm"
            >
              BACK TO QUESTION BANK →
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
