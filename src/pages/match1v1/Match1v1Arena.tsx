// ==============================================================================
// MODULE 10 — PHASE 5: LIVE 1v1 BATTLE ARENA
// File: src/pages/match1v1/Match1v1Arena.tsx
// ==============================================================================

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Match1v1Service } from '../../services/match1v1Service'
import { LeaderboardService } from '../../services/leaderboardService'
import type { UserGlobalRankResult } from '../../types/leaderboard'
import type {
  Match1v1GameState,
  Match1v1Question,
  Match1v1AnswerRecord,
} from '../../types/match1v1'
import { supabase } from '../../lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import {
  Swords,
  Timer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Trophy,
  Zap,
  Award,
  Sparkles,
} from 'lucide-react'

export const Match1v1Arena: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // ----------------------------------------------------------------------------
  // State
  // ----------------------------------------------------------------------------
  const [loading, setLoading] = useState<boolean>(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [gameState, setGameState] = useState<Match1v1GameState | null>(null)
  const [userProgression, setUserProgression] = useState<UserGlobalRankResult | null>(null)
  const [questions, setQuestions] = useState<Match1v1Question[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [submitFeedback, setSubmitFeedback] = useState<{ isCorrect: boolean; points: number } | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const [actionLoading, setActionLoading] = useState<boolean>(false)

  const realtimeChannelRef = useRef<RealtimeChannel | null>(null)
  const countdownIntervalRef = useRef<number | null>(null)
  const questionStartTimeRef = useRef<number>(0)

  // ----------------------------------------------------------------------------
  // Normalized options parser for questions
  // ----------------------------------------------------------------------------
  const parseOptions = useCallback((optionsRaw: Match1v1Question['options']) => {
    if (!optionsRaw) return []
    if (Array.isArray(optionsRaw)) {
      return optionsRaw.map((opt) => {
        if (typeof opt === 'object' && opt !== null) {
          const id = (opt as { id?: string }).id || ''
          const text = (opt as { text?: string }).text || ''
          return { id, text }
        }
        return { id: String(opt), text: String(opt) }
      })
    }
    if (typeof optionsRaw === 'object') {
      return Object.entries(optionsRaw).map(([key, val]) => ({
        id: key,
        text: String(val),
      }))
    }
    return []
  }, [])

  // ----------------------------------------------------------------------------
  // User Authentication Init
  // ----------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        navigate(`/login?redirect=/1v1/${matchId}/battle`)
        return
      }
      if (isMounted) {
        setCurrentUserId(user.id)
      }
    }
    init()
    return () => {
      isMounted = false
    }
  }, [matchId, navigate])

  // ----------------------------------------------------------------------------
  // Authoritative Initial Load
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (!matchId || !currentUserId) return
    let isMounted = true

    const loadInitialState = async () => {
      try {
        const [stateRes, qRes] = await Promise.all([
          Match1v1Service.getGameState(matchId),
          Match1v1Service.getMatchQuestions(matchId),
        ])

        if (!isMounted) return

        if (!stateRes.success || !stateRes.state) {
          setErrorMessage(stateRes.message || 'Failed to load battle state.')
          setLoading(false)
          return
        }

        if (!qRes.success || !qRes.questions) {
          setErrorMessage(qRes.message || 'Failed to load battle questions.')
          setLoading(false)
          return
        }

        const st = stateRes.state
        const qs = qRes.questions

        setGameState(st)
        setQuestions(qs)
        setRemainingSeconds(st.remaining_seconds)

        // Determine initial active question index (first unanswered question)
        const answeredQIds = new Set(st.caller_answers.map((a) => a.question_id))
        const firstUnanswered = qs.findIndex((q) => !answeredQIds.has(q.question_id))

        if (firstUnanswered !== -1) {
          setCurrentIndex(firstUnanswered)
        } else {
          setCurrentIndex(Math.max(0, qs.length - 1))
        }

        questionStartTimeRef.current = Date.now()
      } catch (err: unknown) {
        if (!isMounted) return
        const msg = err instanceof Error ? err.message : 'Network error loading battle'
        setErrorMessage(msg)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadInitialState()

    return () => {
      isMounted = false
    }
  }, [matchId, currentUserId])

  // ----------------------------------------------------------------------------
  // Helper to re-fetch state on finalization or deadline expiry
  // ----------------------------------------------------------------------------
  const refreshAuthoritativeState = useCallback(async () => {
    if (!matchId) return
    const res = await Match1v1Service.getGameState(matchId)
    if (res.success && res.state) {
      setGameState(res.state)
    }
  }, [matchId])

  // ----------------------------------------------------------------------------
  // Authoritative Progression Sync on Match Completion
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (gameState?.status === 'completed' && currentUserId) {
      LeaderboardService.getUserGlobalRank(currentUserId).then((res) => {
        if (res.found) {
          setUserProgression(res)
        }
      })
    }
  }, [gameState?.status, currentUserId])

  // ----------------------------------------------------------------------------
  // Authoritative Countdown Visual Timer
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (!gameState || gameState.status !== 'in_progress' || !gameState.deadline) return

    const tick = () => {
      const deadlineEpoch = new Date(gameState.deadline as string).getTime()
      const nowEpoch = Date.now()
      const diffSecs = Math.max(0, Math.ceil((deadlineEpoch - nowEpoch) / 1000))

      setRemainingSeconds(diffSecs)

      if (diffSecs <= 0) {
        if (countdownIntervalRef.current) {
          window.clearInterval(countdownIntervalRef.current)
        }
        // When visual countdown hits zero, trigger server finalization check
        Match1v1Service.finalizeMatch(matchId as string).then((res) => {
          if (res.success) {
            refreshAuthoritativeState()
          }
        })
      }
    }

    tick()
    countdownIntervalRef.current = window.setInterval(tick, 1000)

    return () => {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current)
      }
    }
  }, [gameState, matchId, refreshAuthoritativeState])

  // ----------------------------------------------------------------------------
  // Real-time Match Synchronization
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (!matchId) return

    realtimeChannelRef.current = Match1v1Service.subscribeToMatch(matchId, (payload) => {
      if (payload.eventType === 'UPDATE' && payload.new) {
        const updatedRow = payload.new as {
          status: string
          challenger_score: number
          opponent_score: number
          winner_id: string | null
          is_draw: boolean
          completed_at: string | null
        }

        setGameState((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            status: updatedRow.status as Match1v1GameState['status'],
            challenger: {
              ...prev.challenger,
              score: updatedRow.challenger_score,
            },
            opponent: {
              ...prev.opponent,
              score: updatedRow.opponent_score,
            },
            winner_id: updatedRow.winner_id,
            is_draw: updatedRow.is_draw,
            completed_at: updatedRow.completed_at,
          }
        })

        // If match transitioned to completed, reload full final state to fetch opponent answers
        if (updatedRow.status === 'completed') {
          Match1v1Service.getGameState(matchId).then((res) => {
            if (res.success && res.state) {
              setGameState(res.state)
            }
          })
        }
      }
    })

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
      }
    }
  }, [matchId])

  // ----------------------------------------------------------------------------
  // Current Question & Caller Answer Status
  // ----------------------------------------------------------------------------
  const currentQuestion: Match1v1Question | undefined = questions[currentIndex]

  const callerAnswerMap = useMemo(() => {
    const map = new Map<string, Match1v1AnswerRecord>()
    if (gameState?.caller_answers) {
      for (const ans of gameState.caller_answers) {
        map.set(ans.question_id, ans)
      }
    }
    return map
  }, [gameState])

  const isCurrentQuestionAnswered = Boolean(
    currentQuestion && callerAnswerMap.has(currentQuestion.question_id)
  )

  const currentAnswerRecord = currentQuestion ? callerAnswerMap.get(currentQuestion.question_id) : undefined

  // Derive active selected option and feedback cleanly without effect
  const activeSelectedOption = currentAnswerRecord ? currentAnswerRecord.selected_option : selectedOption
  const activeSubmitFeedback = currentAnswerRecord
    ? { isCorrect: currentAnswerRecord.is_correct, points: currentAnswerRecord.score_awarded }
    : submitFeedback

  const handleSelectQuestion = useCallback((idx: number) => {
    setCurrentIndex(idx)
    setSelectedOption(null)
    setSubmitFeedback(null)
    questionStartTimeRef.current = Date.now()
  }, [])

  // ----------------------------------------------------------------------------
  // Answer Submission Handler (Server Authoritative)
  // ----------------------------------------------------------------------------
  const handleSubmitAnswer = async () => {
    if (!matchId || !currentQuestion || !selectedOption || submitting || isCurrentQuestionAnswered) {
      return
    }

    setSubmitting(true)
    const timeSpent = Math.max(1, Math.round((Date.now() - questionStartTimeRef.current) / 1000))

    try {
      const res = await Match1v1Service.submitAnswer(
        matchId,
        currentQuestion.question_id,
        selectedOption,
        timeSpent
      )

      if (res.success) {
        setSubmitFeedback({
          isCorrect: Boolean(res.is_correct),
          points: res.score_awarded || 0,
        })

        // Optimistically record answer in local state
        const newRecord: Match1v1AnswerRecord = {
          question_id: currentQuestion.question_id,
          selected_option: selectedOption,
          is_correct: Boolean(res.is_correct),
          score_awarded: res.score_awarded || 0,
          time_spent_seconds: timeSpent,
          submitted_at: new Date().toISOString(),
        }

        setGameState((prev) => {
          if (!prev) return prev
          const isChallenger = prev.is_caller_challenger
          return {
            ...prev,
            status: (res.match_status || prev.status) as Match1v1GameState['status'],
            challenger: isChallenger
              ? {
                  ...prev.challenger,
                  score: res.current_score ?? prev.challenger.score,
                  answered_count: res.answered_count ?? prev.challenger.answered_count,
                }
              : prev.challenger,
            opponent: !isChallenger
              ? {
                  ...prev.opponent,
                  score: res.current_score ?? prev.opponent.score,
                  answered_count: res.answered_count ?? prev.opponent.answered_count,
                }
              : prev.opponent,
            caller_answers: [...prev.caller_answers, newRecord],
          }
        })

        // Auto-advance to next unanswered question after a brief feedback pause
        setTimeout(() => {
          const nextUnanswered = questions.findIndex(
            (q, idx) => idx > currentIndex && !callerAnswerMap.has(q.question_id)
          )
          if (nextUnanswered !== -1) {
            handleSelectQuestion(nextUnanswered)
          } else {
            // Check from beginning for any skipped questions
            const anyUnanswered = questions.findIndex(
              (q) => !callerAnswerMap.has(q.question_id) && q.question_id !== currentQuestion.question_id
            )
            if (anyUnanswered !== -1) {
              handleSelectQuestion(anyUnanswered)
            }
          }
        }, 800)
      } else {
        if (res.error === 'DEADLINE_EXCEEDED') {
          refreshAuthoritativeState()
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ----------------------------------------------------------------------------
  // Finalize Match Trigger (Manual fallback if timer expired or finished)
  // ----------------------------------------------------------------------------
  const handleFinalizeMatch = async () => {
    if (!matchId || actionLoading) return
    setActionLoading(true)
    try {
      const res = await Match1v1Service.finalizeMatch(matchId)
      if (res.success) {
        await refreshAuthoritativeState()
      }
    } finally {
      setActionLoading(false)
    }
  }

  // ----------------------------------------------------------------------------
  // Format Countdown: MM:SS
  // ----------------------------------------------------------------------------
  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
  }

  // ----------------------------------------------------------------------------
  // Loading & Error Screens
  // ----------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#071a2b] text-white flex items-center justify-center pt-20 pb-16 px-4 arena-bg-grid">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#ffd43b] animate-spin mx-auto" />
          <div className="font-display font-black text-lg uppercase tracking-wider">
            INITIALIZING BATTLE ARENA...
          </div>
          <div className="font-mono text-xs text-slate-400">
            Establishing secure connection & verifying battle questions
          </div>
        </div>
      </div>
    )
  }

  if (errorMessage || !gameState) {
    return (
      <div className="min-h-screen bg-[#071a2b] text-white flex items-center justify-center pt-20 pb-16 px-4 arena-bg-grid">
        <div className="bg-[#091522] border-2 border-white/10 p-8 text-center max-w-md rounded-2xl shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="font-display font-black text-2xl uppercase tracking-tight text-white">
            ARENA ACCESS ERROR
          </h2>
          <p className="font-mono text-xs text-slate-300 leading-relaxed">
            {errorMessage || 'Unable to connect to the requested 1v1 battle arena.'}
          </p>
          <Link
            to="/1v1"
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#ffd43b] hover:bg-[#facc15] text-black rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>RETURN TO 1v1 HUB</span>
          </Link>
        </div>
      </div>
    )
  }

  // ----------------------------------------------------------------------------
  // Derived Competitor Information
  // ----------------------------------------------------------------------------
  const isChallenger = gameState.is_caller_challenger
  const you = isChallenger ? gameState.challenger : gameState.opponent
  const opponent = isChallenger ? gameState.opponent : gameState.challenger
  const isCompleted = gameState.status === 'completed'
  const allCallerAnswered = gameState.caller_answers.length >= gameState.question_count

  // ============================================================================
  // TERMINAL RESULTS VIEW (MATCH COMPLETED)
  // ============================================================================
  if (isCompleted) {
    const isWinner = gameState.winner_id === you.id
    const isDraw = gameState.is_draw
    const serverCallerXp = gameState.caller_xp_awarded ?? (isWinner ? 50 : isDraw ? 20 : 5)
    const serverOpponentXp = (isChallenger ? gameState.opponent_xp_awarded : gameState.challenger_xp_awarded) ?? (!isWinner && !isDraw ? 50 : isDraw ? 20 : 5)

    return (
      <div className="min-h-screen bg-[#071a2b] text-white pt-20 pb-16 px-4 sm:px-6 lg:px-8 arena-bg-grid">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Result Banner */}
          <div
            className={`border-2 rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden ${
              isWinner
                ? 'bg-gradient-to-b from-amber-500/10 to-[#091522] border-amber-400/40 shadow-[0_0_40px_rgba(251,191,36,0.15)]'
                : isDraw
                ? 'bg-gradient-to-b from-blue-500/10 to-[#091522] border-blue-400/40 shadow-[0_0_40px_rgba(96,165,250,0.15)]'
                : 'bg-gradient-to-b from-slate-500/10 to-[#091522] border-slate-700 shadow-xl'
            }`}
          >
            <div className="flex justify-center mb-3">
              {isWinner ? (
                <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400 animate-bounce">
                  <Trophy className="w-8 h-8" />
                </div>
              ) : isDraw ? (
                <div className="w-16 h-16 rounded-2xl bg-blue-400/20 border border-blue-400/40 flex items-center justify-center text-blue-400">
                  <Swords className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-700/50 border border-slate-600 flex items-center justify-center text-slate-400">
                  <Award className="w-8 h-8" />
                </div>
              )}
            </div>

            <h1 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight">
              {isWinner ? 'VICTORY' : isDraw ? 'MATCH DRAW' : 'DEFEAT'}
            </h1>
            <p className="font-mono text-xs text-slate-300 mt-1 uppercase tracking-wider">
              {isWinner
                ? 'Outstanding performance. You outmatched your opponent!'
                : isDraw
                ? 'Dead heat! Both competitors finished with identical scores.'
                : 'Tough round. Analyze your attempts and challenge again.'}
            </p>
          </div>

          {/* Server-Authoritative 1v1 XP Awarded & Progression Banner */}
          <div className="bg-[#091522] border border-amber-400/30 rounded-2xl p-5 sm:p-6 shadow-[0_0_30px_rgba(255,212,59,0.08)] space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 text-center sm:text-left">
                <div className="w-12 h-12 rounded-xl bg-[#ffd43b]/10 border border-[#ffd43b]/30 flex items-center justify-center text-[#ffd43b] shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-display font-black text-2xl text-[#ffd43b]">
                      +{serverCallerXp} XP
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[10px] font-bold uppercase tracking-wider">
                      {isWinner ? 'Victory Reward' : isDraw ? 'Stalemate Reward' : 'Match Participation'}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-slate-400 mt-0.5">
                    Server-authoritative match XP added to your unified Apticks progression.
                  </p>
                </div>
              </div>

              {userProgression?.found && (
                <div className="w-full sm:w-64 bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5 shrink-0">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#ffd43b] font-bold">LEVEL {userProgression.level}</span>
                    <span className="text-slate-400 uppercase font-semibold">{userProgression.levelTitle}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-[#ffd43b] transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, userProgression.progressPercentage || 0))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>{userProgression.totalXp?.toLocaleString()} Total XP</span>
                    <span>{userProgression.xpRequired} to next</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Head to Head Score Comparison */}
          <div className="grid grid-cols-2 gap-4 bg-[#091522] border border-white/10 rounded-2xl p-6">
            {/* You */}
            <div className={`p-4 rounded-xl text-center border ${isWinner ? 'bg-amber-500/5 border-amber-500/30' : 'bg-white/5 border-white/5'}`}>
              <div className="w-12 h-12 rounded-full overflow-hidden mx-auto mb-2 border-2 border-white/20">
                {you.avatar_url ? (
                  <img src={you.avatar_url} alt={you.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#ffd43b] text-black font-display font-black flex items-center justify-center text-sm">
                    {you.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="font-display font-bold text-sm text-white truncate">
                @{you.username} (You)
              </div>
              <div className="font-display font-black text-3xl sm:text-4xl text-[#ffd43b] mt-2">
                {you.score}
              </div>
              <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                {gameState.caller_answers.filter((a) => a.is_correct).length} / {gameState.question_count} Correct
              </div>
              <div className="inline-flex items-center gap-1 mt-2.5 px-2.5 py-1 rounded-lg bg-[#ffd43b]/10 text-[#ffd43b] font-mono text-xs font-bold border border-[#ffd43b]/30">
                <Zap className="w-3.5 h-3.5" />
                <span>+{serverCallerXp} XP</span>
              </div>
            </div>

            {/* Opponent */}
            <div className={`p-4 rounded-xl text-center border ${!isWinner && !isDraw ? 'bg-amber-500/5 border-amber-500/30' : 'bg-white/5 border-white/5'}`}>
              <div className="w-12 h-12 rounded-full overflow-hidden mx-auto mb-2 border-2 border-white/20">
                {opponent.avatar_url ? (
                  <img src={opponent.avatar_url} alt={opponent.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-700 text-white font-display font-black flex items-center justify-center text-sm">
                    {opponent.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="font-display font-bold text-sm text-slate-200 truncate">
                @{opponent.username}
              </div>
              <div className="font-display font-black text-3xl sm:text-4xl text-slate-200 mt-2">
                {opponent.score}
              </div>
              <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                {gameState.opponent_answers.filter((a) => a.is_correct).length} / {gameState.question_count} Correct
              </div>
              <div className="inline-flex items-center gap-1 mt-2.5 px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 font-mono text-xs font-bold border border-white/10">
                <Zap className="w-3.5 h-3.5 text-slate-400" />
                <span>+{serverOpponentXp} XP</span>
              </div>
            </div>
          </div>

          {/* Question Breakdown List (Post-Match Transparency) */}
          <div className="bg-[#091522] border border-white/10 rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-black text-sm uppercase tracking-wider text-slate-300">
              ROUND QUESTIONS RECAP ({questions.length})
            </h3>
            <div className="space-y-3">
              {questions.map((q, idx) => {
                const callerAns = callerAnswerMap.get(q.question_id)
                const opponentAns = gameState.opponent_answers.find((a) => a.question_id === q.question_id)

                return (
                  <div
                    key={q.question_id}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-black/40 text-slate-400 font-bold flex items-center justify-center text-[10px]">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-white line-clamp-1">{q.title || q.prompt}</div>
                        <div className="text-[10px] text-slate-400 uppercase">{q.category} • {q.difficulty}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] shrink-0">
                      {/* You */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-[10px]">You:</span>
                        {callerAns?.is_correct ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>+{callerAns.score_awarded}</span>
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold flex items-center gap-0.5">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>+0</span>
                          </span>
                        )}
                      </div>

                      {/* Opponent */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-[10px]">Opponent:</span>
                        {opponentAns?.is_correct ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>+{opponentAns.score_awarded}</span>
                          </span>
                        ) : (
                          <span className="text-rose-400 font-bold flex items-center gap-0.5">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>+0</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Navigation Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/1v1"
              className="w-full sm:w-auto px-6 py-3.5 bg-[#ffd43b] hover:bg-[#facc15] text-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>RETURN TO 1v1 HUB</span>
            </Link>
          </div>

        </div>
      </div>
    )
  }

  // ============================================================================
  // ACTIVE BATTLE VIEW
  // ============================================================================
  const optionsList = currentQuestion ? parseOptions(currentQuestion.options) : []

  return (
    <div className="min-h-screen bg-[#071a2b] text-white pt-20 pb-16 px-4 sm:px-6 lg:px-8 arena-bg-grid">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ===================================================================== */}
        {/* TOP BAR: BRANDING + QUESTION INDEX + AUTHORITATIVE TIMER              */}
        {/* ===================================================================== */}
        <div className="bg-[#091522] border border-white/10 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-xs uppercase tracking-wider text-[#ffd43b]">
              APTICKS
            </span>
            <span className="text-white/20">/</span>
            <span className="font-mono text-xs text-slate-400 font-semibold uppercase">
              1v1 BATTLE ARENA
            </span>
          </div>

          {/* Question Index */}
          <div className="font-mono font-bold text-xs text-slate-300">
            QUESTION {currentIndex + 1} / {questions.length}
          </div>

          {/* Authoritative Countdown */}
          <div className={`flex items-center gap-1.5 font-mono font-black text-sm px-3 py-1 rounded-lg border ${
            remainingSeconds <= 30
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
              : 'bg-white/5 text-[#ffd43b] border-white/10'
          }`}>
            <Timer className="w-4 h-4" />
            <span>{formatCountdown(remainingSeconds)}</span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* VERSUS HEADER: YOU VS OPPONENT REALTIME STATUS                        */}
        {/* ===================================================================== */}
        <div className="bg-[#091522] border border-white/10 rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-11 items-center">
            {/* You (Left) */}
            <div className="col-span-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 shrink-0">
                {you.avatar_url ? (
                  <img src={you.avatar_url} alt={you.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#ffd43b] text-black font-display font-black flex items-center justify-center text-xs">
                    {you.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold text-xs text-white truncate">
                  @{you.username} <span className="text-[#ffd43b] text-[10px] font-mono">(You)</span>
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  Answered: {gameState.caller_answers.length} / {gameState.question_count}
                </div>
              </div>
              <div className="ml-auto font-display font-black text-xl text-[#ffd43b] pr-2">
                {you.score}
              </div>
            </div>

            {/* VS Badge (Center) */}
            <div className="col-span-1 text-center font-display font-black text-xs text-slate-500 uppercase tracking-widest">
              VS
            </div>

            {/* Opponent (Right) */}
            <div className="col-span-5 flex items-center justify-end gap-3 text-right">
              <div className="mr-auto font-display font-black text-xl text-slate-300 pl-2">
                {opponent.score}
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold text-xs text-slate-300 truncate">
                  @{opponent.username}
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  Answered: {opponent.answered_count} / {gameState.question_count}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shrink-0">
                {opponent.avatar_url ? (
                  <img src={opponent.avatar_url} alt={opponent.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-700 text-white font-display font-black flex items-center justify-center text-xs">
                    {opponent.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* QUESTION STEPPER BAR                                                  */}
        {/* ===================================================================== */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {questions.map((q, idx) => {
            const isAns = callerAnswerMap.has(q.question_id)
            const ans = callerAnswerMap.get(q.question_id)
            const isCurrent = idx === currentIndex

            return (
              <button
                key={q.question_id}
                type="button"
                onClick={() => handleSelectQuestion(idx)}
                className={`flex-1 min-w-[36px] py-2 rounded-xl font-mono text-xs font-bold transition-all border cursor-pointer ${
                  isCurrent
                    ? 'bg-[#ffd43b] text-black border-[#ffd43b] shadow-md'
                    : isAns
                    ? ans?.is_correct
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
                }`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>

        {/* ===================================================================== */}
        {/* QUESTION CARD & INTERACTIVE OPTIONS                                   */}
        {/* ===================================================================== */}
        {currentQuestion && (
          <div className="bg-[#091522] border border-white/10 rounded-2xl p-6 sm:p-8 space-y-6">

            {/* Question Meta Header */}
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-white/5 border border-white/10 font-mono text-[11px] font-bold uppercase text-slate-300">
                  {currentQuestion.category}
                </span>
                {currentQuestion.difficulty && (
                  <span className={`px-2.5 py-1 rounded font-mono text-[11px] font-bold uppercase ${
                    currentQuestion.difficulty === 'easy'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : currentQuestion.difficulty === 'medium'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}>
                    {currentQuestion.difficulty}
                  </span>
                )}
              </div>

              <div className="font-mono text-xs text-[#ffd43b] font-bold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                <span>{currentQuestion.points || 10} PTS</span>
              </div>
            </div>

            {/* Question Body */}
            <div className="space-y-2">
              <h2 className="font-display font-black text-lg sm:text-xl text-white leading-snug">
                {currentQuestion.title}
              </h2>
              <div className="font-sans text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-wrap">
                {currentQuestion.prompt}
              </div>
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-1 gap-3 pt-2">
              {optionsList.map((opt) => {
                const isSelected = activeSelectedOption === opt.id
                const isAnswerLocked = isCurrentQuestionAnswered

                let optStyle = 'bg-white/5 border-white/10 text-slate-200 hover:border-white/20'

                if (isAnswerLocked) {
                  if (isSelected) {
                    optStyle = activeSubmitFeedback?.isCorrect
                      ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400 text-rose-200'
                  } else {
                    optStyle = 'bg-white/5 border-white/5 text-slate-400 opacity-60'
                  }
                } else if (isSelected) {
                  optStyle = 'bg-[#ffd43b]/10 border-[#ffd43b] text-[#ffd43b] font-bold shadow-sm'
                }

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isAnswerLocked || submitting}
                    onClick={() => setSelectedOption(opt.id)}
                    className={`w-full p-4 rounded-xl border text-left font-mono text-xs sm:text-sm flex items-center gap-4 transition-all ${optStyle} ${
                      isAnswerLocked ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                      isSelected
                        ? isAnswerLocked
                          ? activeSubmitFeedback?.isCorrect
                            ? 'bg-emerald-500 text-black'
                            : 'bg-rose-500 text-white'
                          : 'bg-[#ffd43b] text-black'
                        : 'bg-white/10 text-slate-300'
                    }`}>
                      {opt.id}
                    </span>
                    <span className="flex-1 font-sans">{opt.text}</span>

                    {/* Feedback Icon */}
                    {isAnswerLocked && isSelected && (
                      <span className="shrink-0">
                        {activeSubmitFeedback?.isCorrect ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-400" />
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Feedback & Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
              {/* Left: Feedback text */}
              <div>
                {isCurrentQuestionAnswered && activeSubmitFeedback ? (
                  <div className={`font-mono text-xs font-bold flex items-center gap-1.5 ${
                    activeSubmitFeedback.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {activeSubmitFeedback.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>CORRECT (+{activeSubmitFeedback.points} PTS)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        <span>INCORRECT (+0 PTS)</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="font-mono text-xs text-slate-400">
                    Select an option and submit. Answers are securely evaluated on the server.
                  </div>
                )}
              </div>

              {/* Right: Submit / Next Buttons */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {!isCurrentQuestionAnswered ? (
                  <button
                    type="button"
                    disabled={!selectedOption || submitting}
                    onClick={handleSubmitAnswer}
                    className={`w-full sm:w-auto px-6 py-3 bg-[#ffd43b] hover:bg-[#facc15] text-black rounded-xl font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      !selectedOption || submitting ? 'opacity-50 cursor-not-allowed' : 'shadow-md'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>EVALUATING...</span>
                      </>
                    ) : (
                      <>
                        <span>SUBMIT ANSWER</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentIndex < questions.length - 1) {
                        handleSelectQuestion(currentIndex + 1)
                      }
                    }}
                    disabled={currentIndex >= questions.length - 1}
                    className="w-full sm:w-auto px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <span>NEXT QUESTION</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* WAITING FOR OPPONENT MESSAGE (IF YOU FINISHED ALL QUESTIONS EARLY)    */}
        {/* ===================================================================== */}
        {allCallerAnswered && !isCompleted && (
          <div className="bg-[#091522] border border-amber-400/30 rounded-2xl p-5 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-display font-black text-sm uppercase tracking-wider">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>YOU HAVE COMPLETED ALL QUESTIONS</span>
            </div>
            <p className="font-mono text-xs text-slate-300 max-w-md mx-auto">
              Waiting for @{opponent.username} to finish their round ({opponent.answered_count} / {gameState.question_count} answered) or until the match timer expires.
            </p>
            {remainingSeconds <= 0 && (
              <button
                type="button"
                onClick={handleFinalizeMatch}
                disabled={actionLoading}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-mono text-xs font-bold transition-all cursor-pointer"
              >
                FINALIZE MATCH NOW
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
export default Match1v1Arena
