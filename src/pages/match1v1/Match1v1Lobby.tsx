// ==============================================================================
// MODULE 10 — PHASE 4: 1v1 MATCH LOBBY
// File: src/pages/match1v1/Match1v1Lobby.tsx
// ==============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Swords,
  Clock,
  Shield,
  Check,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Flame,
  Zap,
  RefreshCw,
  Award,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { Match1v1Service } from '../../services/match1v1Service'
import type { Match1v1, Match1v1Question } from '../../types/match1v1'
import type { RealtimeChannel } from '@supabase/supabase-js'

export default function Match1v1Lobby() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()

  const [match, setMatch] = useState<Match1v1 | null>(null)
  const [questions, setQuestions] = useState<Match1v1Question[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Realtime channel ref
  const realtimeSubRef = useRef<RealtimeChannel | null>(null)

  // Toast notification
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast({ text, type })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000)
  }, [])

  // ----------------------------------------------------------------------------
  // 1. Initial Load & Fetch Match Data
  // ----------------------------------------------------------------------------
  const fetchMatchData = useCallback(async (id: string) => {
    try {
      const res = await Match1v1Service.getMatch(id)
      if (!res.success || !res.match) {
        setErrorMessage(res.message || 'Match not found or you are not an authorized participant.')
        setLoading(false)
        return
      }

      setMatch(res.match)
      setErrorMessage(null)

      // If match is accepted or in_progress, also fetch sanitized questions (anti-cheat verified)
      if (['accepted', 'in_progress', 'completed'].includes(res.match.status)) {
        const qRes = await Match1v1Service.getMatchQuestions(id)
        if (qRes.success && qRes.questions) {
          setQuestions(qRes.questions)
        }
      }
    } catch {
      setErrorMessage('Failed to connect to battle server.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function init() {
      if (!matchId) {
        navigate('/1v1')
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate(`/login?redirect=/1v1/${matchId}`)
        return
      }

      if (isMounted) {
        fetchMatchData(matchId)
      }
    }

    init()
    return () => {
      isMounted = false
    }
  }, [matchId, navigate, fetchMatchData])

  // ----------------------------------------------------------------------------
  // 2. Realtime Synchronization
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (!matchId) return

    realtimeSubRef.current = Match1v1Service.subscribeToMatch(matchId, (payload) => {
      if (payload.eventType === 'UPDATE' && payload.new) {
        const updatedRow = payload.new as { status: string; started_at: string | null }
        setMatch((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            status: updatedRow.status as Match1v1['status'],
            started_at: updatedRow.started_at,
          }
        })

        // If match transitioned to in_progress, transition to Battle Arena!
        if (updatedRow.status === 'in_progress') {
          navigate(`/1v1/${matchId}/battle`)
          return
        }

        // Re-fetch match details to stay authoritative
        fetchMatchData(matchId)
      }
    })

    return () => {
      if (realtimeSubRef.current) {
        supabase.removeChannel(realtimeSubRef.current)
      }
    }
  }, [matchId, fetchMatchData, navigate])

  // ----------------------------------------------------------------------------
  // 3. Match Actions (Start, Accept, Decline, Cancel)
  // ----------------------------------------------------------------------------
  const handleStartBattle = async () => {
    if (!matchId || actionLoading) return
    setActionLoading(true)
    try {
      const res = await Match1v1Service.startMatch(matchId)
      if (res.success) {
        showToast('Battle started! Entering arena...')
        navigate(`/1v1/${matchId}/battle`)
      } else {
        showToast(res.message || 'Failed to start match', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleAcceptChallenge = async () => {
    if (!matchId || actionLoading) return
    setActionLoading(true)
    try {
      const res = await Match1v1Service.respondToChallenge(matchId, 'accept')
      if (res.success) {
        showToast('Challenge accepted! Battle lobby ready.')
        fetchMatchData(matchId)
      } else {
        showToast(res.message || 'Failed to accept challenge', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeclineChallenge = async () => {
    if (!matchId || actionLoading) return
    setActionLoading(true)
    try {
      const res = await Match1v1Service.respondToChallenge(matchId, 'decline')
      if (res.success) {
        showToast('Challenge declined.')
        navigate('/1v1')
      } else {
        showToast(res.message || 'Failed to decline challenge', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelChallenge = async () => {
    if (!matchId || actionLoading) return
    setActionLoading(true)
    try {
      const res = await Match1v1Service.cancelChallenge(matchId)
      if (res.success) {
        showToast('Challenge cancelled.')
        navigate('/1v1')
      } else {
        showToast(res.message || 'Failed to cancel challenge', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  // ----------------------------------------------------------------------------
  // Loading & Error States
  // ----------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#071a2b] text-white flex items-center justify-center pt-20 pb-16 px-4 arena-bg-grid">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#ffd43b] animate-spin mx-auto" />
          <div className="font-display font-black text-lg uppercase tracking-wider">
            CONNECTING TO BATTLE LOBBY...
          </div>
          <div className="font-mono text-xs text-slate-400">
            Synchronizing participants and competitive parameters
          </div>
        </div>
      </div>
    )
  }

  if (errorMessage || !match) {
    return (
      <div className="min-h-screen bg-[#071a2b] text-white flex items-center justify-center pt-20 pb-16 px-4 arena-bg-grid">
        <div className="bg-[#091522] border-3 border-black p-8 text-center max-w-md rounded-2xl shadow-[8px_8px_0_#000] space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="font-display font-black text-2xl uppercase tracking-tight text-white">
            ACCESS RESTRICTED
          </h2>
          <p className="font-mono text-xs text-slate-300 leading-relaxed">
            {errorMessage || 'You are not a participant in this 1v1 battle, or the match has expired.'}
          </p>
          <Link
            to="/1v1"
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#ffd43b] hover:bg-[#facc15] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#000] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>RETURN TO 1v1 HUB</span>
          </Link>
        </div>
      </div>
    )
  }

  const isChallenger = match.is_caller_challenger
  const isOpponent = !isChallenger
  const isPending = match.status === 'pending' || match.status === 'waiting'
  const isAccepted = match.status === 'accepted'
  const isInProgress = match.status === 'in_progress'
  const isTerminated = ['declined', 'cancelled', 'completed', 'abandoned'].includes(match.status)

  return (
    <div className="min-h-screen bg-[#071a2b] text-white pt-20 pb-16 px-4 sm:px-6 lg:px-8 arena-bg-grid">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            to="/1v1"
            className="inline-flex items-center gap-2 text-xs font-mono font-bold text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to 1v1 Arena</span>
          </Link>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Realtime Synchronized</span>
          </div>
        </div>

        {/* Toast Alert */}
        {toast && (
          <div
            className={`p-4 rounded-xl border font-mono text-xs flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-2 ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{toast.text}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MAIN LOBBY BATTLE CARD                                                    */}
        {/* ========================================================================= */}
        <div className="bg-[#091522] border-3 border-black rounded-2xl p-6 sm:p-8 shadow-[8px_8px_0_#ffd43b] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#ffd43b]/10 to-transparent pointer-events-none rounded-full blur-3xl" />

          {/* Lobby Status Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#ffd43b]/10 border border-[#ffd43b]/30 text-[#ffd43b] text-xs font-mono font-bold uppercase tracking-wider mb-2">
                <Shield className="w-3.5 h-3.5" />
                <span>Sector 1v1 Battle Lobby</span>
              </div>
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight uppercase leading-none">
                HEAD-TO-HEAD DUEL
              </h1>
            </div>

            {/* Status Chip */}
            <div className="self-start sm:self-center">
              {isPending && (
                <span className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono text-xs font-bold uppercase flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Waiting for Response</span>
                </span>
              )}
              {isAccepted && (
                <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono text-xs font-bold uppercase flex items-center gap-1.5 animate-pulse">
                  <Check className="w-3.5 h-3.5" />
                  <span>Accepted • Ready to Engage</span>
                </span>
              )}
              {isInProgress && (
                <span className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-300 border border-rose-500/30 font-mono text-xs font-bold uppercase flex items-center gap-1.5 animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>In Progress</span>
                </span>
              )}
              {isTerminated && (
                <span className="px-3.5 py-1.5 rounded-xl bg-white/10 text-slate-300 border border-white/20 font-mono text-xs font-bold uppercase">
                  {match.status}
                </span>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* COMPETITORS FACE-OFF (CHALLENGER VS OPPONENT)                             */}
          {/* ========================================================================= */}
          <div className="py-8 grid grid-cols-1 md:grid-cols-5 gap-6 items-center relative z-10">

            {/* Challenger Card */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3">
              <div className="w-20 h-20 rounded-2xl bg-[#0d1e30] border-2 border-white/20 flex items-center justify-center font-display font-black text-2xl text-white mx-auto overflow-hidden shadow-lg">
                {match.challenger.avatar_url ? (
                  <img src={match.challenger.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  match.challenger.username[0]?.toUpperCase()
                )}
              </div>

              <div>
                <div className="font-display font-black text-lg text-white truncate">
                  {match.challenger.display_name || match.challenger.username}
                </div>
                <div className="font-mono text-xs text-slate-400">
                  @{match.challenger.username}
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/40 border border-white/10 font-mono text-xs text-slate-300">
                <Award className="w-3.5 h-3.5 text-[#ffd43b]" />
                <span>Level {match.challenger.level} • {match.challenger.level_title}</span>
              </div>

              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                Challenger {isChallenger && '(You)'}
              </div>
            </div>

            {/* VS Emblem */}
            <div className="text-center md:col-span-1 flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-[#ffd43b] text-black border-2 border-black flex items-center justify-center font-display font-black text-sm shadow-[3px_3px_0_#000]">
                VS
              </div>
              <div className="mt-2 font-mono text-[11px] text-slate-400 uppercase tracking-widest">
                DUEL
              </div>
            </div>

            {/* Opponent Card */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-white/5 border border-white/10 text-center space-y-3">
              <div className="w-20 h-20 rounded-2xl bg-[#0d1e30] border-2 border-white/20 flex items-center justify-center font-display font-black text-2xl text-white mx-auto overflow-hidden shadow-lg">
                {match.opponent.avatar_url ? (
                  <img src={match.opponent.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  match.opponent.username[0]?.toUpperCase()
                )}
              </div>

              <div>
                <div className="font-display font-black text-lg text-white truncate">
                  {match.opponent.display_name || match.opponent.username}
                </div>
                <div className="font-mono text-xs text-slate-400">
                  @{match.opponent.username}
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/40 border border-white/10 font-mono text-xs text-slate-300">
                <Award className="w-3.5 h-3.5 text-[#ffd43b]" />
                <span>Level {match.opponent.level} • {match.opponent.level_title}</span>
              </div>

              <div className="text-[11px] font-mono text-slate-500 uppercase tracking-wider font-semibold">
                Opponent {isOpponent && '(You)'}
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* BATTLE METRICS (CATEGORY, QUESTIONS, TIMER)                              */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/10 grid grid-cols-3 gap-3 text-center font-mono text-xs relative z-10">
            <div>
              <div className="text-slate-400 text-[10px] uppercase font-bold">Category</div>
              <div className="text-white font-bold mt-0.5 truncate">{match.category}</div>
            </div>
            <div className="border-x border-white/10">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Questions</div>
              <div className="text-white font-bold mt-0.5">{match.question_count} Rounds</div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px] uppercase font-bold">Time Limit</div>
              <div className="text-white font-bold mt-0.5">{match.time_per_question_seconds}s / Round</div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LOBBY CONTROLS & ACTIONS                                                  */}
          {/* ========================================================================= */}
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
            <div className="text-xs font-mono text-slate-400 text-center sm:text-left">
              {isPending && isChallenger && 'Waiting for your competitor to accept the duel...'}
              {isPending && isOpponent && 'You have been challenged! Review the parameters and accept below.'}
              {isAccepted && 'Both competitors ready. Click Start Battle to initialize live test questions.'}
              {isInProgress && 'Match session active. Server is evaluating live rounds.'}
              {isTerminated && `This challenge was ${match.status}.`}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* If Pending & Caller is Opponent: Can Accept or Decline */}
              {isPending && isOpponent && (
                <>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleAcceptChallenge}
                    className="flex-1 sm:flex-initial px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#000] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>ACCEPT CHALLENGE</span>
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleDeclineChallenge}
                    className="px-4 py-3 bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-white/10 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer"
                  >
                    DECLINE
                  </button>
                </>
              )}

              {/* If Pending & Caller is Challenger: Can Cancel */}
              {isPending && isChallenger && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleCancelChallenge}
                  className="w-full sm:w-auto px-4 py-3 bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-white/10 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer"
                >
                  CANCEL CHALLENGE
                </button>
              )}

              {/* If Accepted: Start Match */}
              {isAccepted && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleStartBattle}
                  className="w-full sm:w-auto px-6 py-3.5 bg-[#ffd43b] hover:bg-[#facc15] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#000] flex items-center justify-center gap-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer animate-pulse"
                >
                  <Swords className="w-4 h-4" />
                  <span>START BATTLE NOW</span>
                </button>
              )}

              {/* If In Progress: Enter Battle Arena */}
              {isInProgress && (
                <Link
                  to={`/1v1/${matchId}/battle`}
                  className="w-full sm:w-auto px-6 py-3.5 bg-[#ffd43b] hover:bg-[#facc15] text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider shadow-[3px_3px_0_#000] flex items-center justify-center gap-2 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer animate-pulse"
                >
                  <Swords className="w-4 h-4" />
                  <span>ENTER BATTLE ARENA</span>
                </Link>
              )}

              {/* If Terminated: Return link */}
              {isTerminated && (
                <Link
                  to="/1v1"
                  className="w-full sm:w-auto px-5 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-mono text-xs font-bold text-center transition-all"
                >
                  Return to 1v1 Arena
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PREVIEW OF ASSIGNED QUESTIONS (ANTI-CHEAT VERIFIED: NO ANSWERS)          */}
        {/* ========================================================================= */}
        {questions.length > 0 && (
          <div className="bg-[#091522] border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-base text-white uppercase tracking-tight flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#ffd43b]" />
                  <span>Assigned Battle Questions ({questions.length})</span>
                </h3>
                <p className="font-mono text-xs text-slate-400 mt-0.5">
                  Server-curated round preview. Answers and explanations are securely sealed until gameplay conclusion.
                </p>
              </div>

              <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono text-[10px] font-bold uppercase">
                Anti-Cheat Locked
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {questions.map((q) => (
                <div
                  key={q.question_id}
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="font-bold text-[#ffd43b]">ROUND #{q.order_index}</span>
                    <span>{q.difficulty}</span>
                  </div>
                  <div className="font-display font-bold text-xs text-white line-clamp-1">
                    {q.title}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 line-clamp-2">
                    {q.prompt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
