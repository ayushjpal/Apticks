// ==============================================================================
// MODULE 10: 1V1 COMPETITIVE HUB (REFINED UI/UX)
// File: src/pages/match1v1/Match1v1Hub.tsx
// ==============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Swords,
  Search,
  Clock,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Flame,
  Zap,
  Timer,
  Award,
  Hash,
  ShieldCheck,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { supabase } from '../../lib/supabase'
import { Match1v1Service } from '../../services/match1v1Service'
import { SocialService, type FriendUserItem, type SocialUserSummary } from '../../services/socialService'
import type {
  IncomingChallenge,
  OutgoingChallenge,
  ActiveMatchItem,
} from '../../types/match1v1'
import type { RealtimeChannel } from '@supabase/supabase-js'

const CATEGORIES = [
  'All Topics',
  'Quantitative Aptitude',
  'Logical Reasoning',
  'Data Interpretation',
  'Verbal & Abstract',
]

const QUESTION_COUNTS = [3, 5, 10]
const TIMER_OPTIONS = [30, 60, 90, 120]

export default function Match1v1Hub() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const currentTab = (searchParams.get('tab') as 'queue' | 'challenge' | 'pending' | 'active') || 'queue'
  const setTab = useCallback((tab: 'queue' | 'challenge' | 'pending' | 'active') => {
    setSearchParams({ tab })
  }, [setSearchParams])

  // Current authenticated user
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Config State
  const [selectedCategory, setSelectedCategory] = useState<string>('All Topics')
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<number>(5)
  const [selectedTimer, setSelectedTimer] = useState<number>(60)

  // Queue State
  const [isQueuing, setIsQueuing] = useState(false)
  const [queueElapsed, setQueueElapsed] = useState(0)
  const [queueMessage, setQueueMessage] = useState<string>('')
  const queueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Direct Challenge Competitor Selection
  const [friends, setFriends] = useState<FriendUserItem[]>([])
  const [friendsLoading, setFriendsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SocialUserSummary[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [selectedCompetitor, setSelectedCompetitor] = useState<{
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    level?: number
  } | null>(null)
  const [issuingChallenge, setIssuingChallenge] = useState(false)

  // Pending & Active Challenges
  const [incoming, setIncoming] = useState<IncomingChallenge[]>([])
  const [outgoing, setOutgoing] = useState<OutgoingChallenge[]>([])
  const [activeMatches, setActiveMatches] = useState<ActiveMatchItem[]>([])
  const [loadingChallenges, setLoadingChallenges] = useState(false)
  const [actionMatchId, setActionMatchId] = useState<string | null>(null)

  // Toast notification
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast({ text, type })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 4000)
  }, [])

  // ----------------------------------------------------------------------------
  // 1. Initial Load & Auth
  // ----------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    async function initUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login?redirect=/1v1')
        return
      }
      if (isMounted) {
        setCurrentUserId(user.id)
      }
    }

    initUser()
    return () => {
      isMounted = false
    }
  }, [navigate])

  // ----------------------------------------------------------------------------
  // 2. Fetch Challenges & Friends
  // ----------------------------------------------------------------------------
  const fetchChallenges = useCallback(async () => {
    if (!currentUserId) return
    setLoadingChallenges(true)
    try {
      const res = await Match1v1Service.getMyChallenges()
      if (res.success && res.data) {
        setIncoming(res.data.incoming)
        setOutgoing(res.data.outgoing)
        setActiveMatches(res.data.active)
      }
    } finally {
      setLoadingChallenges(false)
    }
  }, [currentUserId])

  useEffect(() => {
    if (!currentUserId) return
    let isMounted = true

    const loadInitialData = async () => {
      setLoadingChallenges(true)
      const chRes = await Match1v1Service.getMyChallenges()
      if (isMounted && chRes.success && chRes.data) {
        setIncoming(chRes.data.incoming)
        setOutgoing(chRes.data.outgoing)
        setActiveMatches(chRes.data.active)
      }
      setLoadingChallenges(false)

      setFriendsLoading(true)
      const frRes = await SocialService.getMyFriends(20, 0)
      if (isMounted && frRes.success && frRes.friends) {
        setFriends(frRes.friends)
      }
      setFriendsLoading(false)
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [currentUserId])

  // Preselect target competitor if query param is set (e.g. /1v1?challenge=username)
  useEffect(() => {
    const targetUsername = searchParams.get('challenge')
    if (targetUsername && currentUserId) {
      SocialService.getPublicProfile(targetUsername).then((res) => {
        if (res.success && res.profile) {
          setSelectedCompetitor({
            id: res.profile.id,
            username: res.profile.username,
            display_name: res.profile.display_name,
            avatar_url: res.profile.avatar_url,
            level: res.profile.level,
          })
          setTab('challenge')
        }
      })
    }
  }, [searchParams, currentUserId, setTab])

  // ----------------------------------------------------------------------------
  // 3. User Search for Direct Challenge
  // ----------------------------------------------------------------------------
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q || q.length < 2) {
      const clearTimer = setTimeout(() => setSearchResults([]), 0)
      return () => clearTimeout(clearTimer)
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true)
      try {
        const res = await SocialService.searchUsers(q, 5)
        if (res.success && res.users) {
          // Filter out self
          const filtered = res.users.filter(
            (u: SocialUserSummary) => u.id !== currentUserId
          )
          setSearchResults(filtered)
        }
      } finally {
        setSearchingUsers(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery, currentUserId])

  // ----------------------------------------------------------------------------
  // 4. Matchmaking Queue Logic
  // ----------------------------------------------------------------------------
  const handleJoinQueue = async () => {
    if (isQueuing) return
    setIsQueuing(true)
    setQueueElapsed(0)
    setQueueMessage('Entering matchmaking queue...')

    try {
      const res = await Match1v1Service.joinMatchmaking(
        selectedCategory,
        selectedQuestionCount,
        selectedTimer
      )

      if (!res.success) {
        setIsQueuing(false)
        showToast(res.message || 'Failed to enter queue', 'error')
        return
      }

      if (res.status === 'matched' && res.match_id) {
        showToast('Opponent matched! Entering battle lobby...')
        setIsQueuing(false)
        navigate(`/1v1/${res.match_id}`)
        return
      }

      setQueueMessage('Searching for a worthy competitor...')
    } catch {
      setIsQueuing(false)
      showToast('Network error while joining matchmaking', 'error')
    }
  }

  const handleLeaveQueue = async () => {
    try {
      await Match1v1Service.leaveMatchmaking()
      setIsQueuing(false)
      setQueueElapsed(0)
      showToast('Left matchmaking queue.')
    } catch {
      setIsQueuing(false)
    }
  }

  // Queue elapsed timer
  useEffect(() => {
    if (isQueuing) {
      queueTimerRef.current = setInterval(() => {
        setQueueElapsed((prev) => prev + 1)
      }, 1000)
    } else {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current)
    }
    return () => {
      if (queueTimerRef.current) clearInterval(queueTimerRef.current)
    }
  }, [isQueuing])

  // Realtime listener for matchmaking queue resolution
  useEffect(() => {
    if (!currentUserId || !isQueuing) return

    let sub: RealtimeChannel | null = null

    sub = supabase
      .channel(`queue_matches_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches_1v1',
        },
        (payload) => {
          const newMatch = payload.new as {
            id: string
            challenger_id: string
            opponent_id: string
            status: string
          }
          if (
            (newMatch.challenger_id === currentUserId || newMatch.opponent_id === currentUserId) &&
            newMatch.status === 'accepted'
          ) {
            setIsQueuing(false)
            showToast('Match found! Entering battle lobby...')
            navigate(`/1v1/${newMatch.id}`)
          }
        }
      )
      .subscribe()

    // Also poll every 3 seconds while in queue
    const pollInterval = setInterval(async () => {
      if (!isQueuing) return
      const res = await Match1v1Service.getMyChallenges()
      if (res.success && res.data && res.data.active.length > 0) {
        const latest = res.data.active[0]
        if (latest.status === 'accepted') {
          setIsQueuing(false)
          navigate(`/1v1/${latest.id}`)
        }
      }
    }, 3000)

    return () => {
      if (sub) supabase.removeChannel(sub)
      clearInterval(pollInterval)
    }
  }, [currentUserId, isQueuing, navigate, showToast])

  // ----------------------------------------------------------------------------
  // 5. Direct Challenge Dispatch
  // ----------------------------------------------------------------------------
  const handleSendChallenge = async () => {
    if (!selectedCompetitor) {
      showToast('Please select a competitor to challenge.', 'error')
      return
    }

    setIssuingChallenge(true)
    try {
      const res = await Match1v1Service.createChallenge(
        selectedCompetitor.id,
        selectedCategory,
        selectedQuestionCount,
        selectedTimer
      )

      if (res.success && res.match_id) {
        showToast(`Challenge dispatched to @${selectedCompetitor.username}!`)
        setSelectedCompetitor(null)
        setSearchQuery('')
        fetchChallenges()
        setTab('pending')
      } else {
        showToast(res.message || 'Failed to send challenge', 'error')
      }
    } finally {
      setIssuingChallenge(false)
    }
  }

  // ----------------------------------------------------------------------------
  // 6. Respond to Challenge (Accept / Decline) & Cancel
  // ----------------------------------------------------------------------------
  const handleAccept = async (matchId: string) => {
    setActionMatchId(matchId)
    try {
      const res = await Match1v1Service.respondToChallenge(matchId, 'accept')
      if (res.success && res.match_id) {
        showToast('Challenge accepted! Entering lobby...')
        navigate(`/1v1/${res.match_id}`)
      } else {
        showToast(res.message || 'Failed to accept challenge', 'error')
      }
    } finally {
      setActionMatchId(null)
      fetchChallenges()
    }
  }

  const handleDecline = async (matchId: string) => {
    setActionMatchId(matchId)
    try {
      const res = await Match1v1Service.respondToChallenge(matchId, 'decline')
      if (res.success) {
        showToast('Challenge declined.')
        fetchChallenges()
      } else {
        showToast(res.message || 'Failed to decline challenge', 'error')
      }
    } finally {
      setActionMatchId(null)
    }
  }

  const handleCancel = async (matchId: string) => {
    setActionMatchId(matchId)
    try {
      const res = await Match1v1Service.cancelChallenge(matchId)
      if (res.success) {
        showToast('Challenge cancelled.')
        fetchChallenges()
      } else {
        showToast(res.message || 'Failed to cancel challenge', 'error')
      }
    } finally {
      setActionMatchId(null)
    }
  }

  // Helper formatting for seconds: MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return `${mins}:${rem.toString().padStart(2, '0')}`
  }

  return (
    <AppLayout maxWidth="wide">
      <div className="max-w-6xl mx-auto space-y-5 pb-12 animate-entry">

        {/* ========================================================================= */}
        {/* TOP SECTION: COMPACT PAGE HEADER                                          */}
        {/* ========================================================================= */}
        <div className="bg-[#0c1d2d] border border-white/10 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight leading-none">
                1V1
              </h1>
              <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono text-[11px] font-semibold tracking-wider uppercase">
                Arena
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm font-body text-slate-400">
              Challenge another Apticks user to a live aptitude match.
            </p>
          </div>

          {activeMatches.length > 0 && (
            <button
              type="button"
              onClick={() => navigate(`/1v1/${activeMatches[0].id}`)}
              className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              <span>Active Battle In Lobby</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Toast Alert */}
        {toast && (
          <div
            className={`p-3 rounded-lg border font-mono text-xs flex items-center gap-2.5 transition-all animate-in fade-in slide-in-from-top-1 ${
              toast.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
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
        {/* MODE TABS (CLEAN SEGMENTED CONTROLS)                                      */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 overflow-x-auto select-none">
          <button
            type="button"
            onClick={() => setTab('queue')}
            className={`px-3.5 py-2 rounded-lg font-display font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              currentTab === 'queue'
                ? 'bg-[#ffd43b] text-[#071a2b] shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>FIND MATCH</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('challenge')}
            className={`px-3.5 py-2 rounded-lg font-display font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              currentTab === 'challenge'
                ? 'bg-[#ffd43b] text-[#071a2b] shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>CHALLENGE</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`px-3.5 py-2 rounded-lg font-display font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              currentTab === 'pending'
                ? 'bg-[#ffd43b] text-[#071a2b] shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>PENDING</span>
            {(incoming.length > 0 || outgoing.length > 0) && (
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  currentTab === 'pending' ? 'bg-[#071a2b] text-[#ffd43b]' : 'bg-[#ffd43b] text-[#071a2b]'
                }`}
              >
                {incoming.length + outgoing.length}
              </span>
            )}
          </button>

          {activeMatches.length > 0 && (
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`px-3.5 py-2 rounded-lg font-display font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                currentTab === 'active'
                  ? 'bg-[#ffd43b] text-[#071a2b] shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-emerald-400" />
              <span>ACTIVE</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  currentTab === 'active' ? 'bg-[#071a2b] text-[#ffd43b]' : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {activeMatches.length}
              </span>
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: FIND MATCH (COMPACT MATCHMAKING CONFIGURATION)                     */}
        {/* ========================================================================= */}
        {currentTab === 'queue' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Matchmaking Settings */}
            <div className="lg:col-span-8 bg-[#0c1d2d] border border-white/10 rounded-xl p-5 sm:p-6 space-y-5 shadow-sm">
              <div>
                <h2 className="font-display font-bold text-base sm:text-lg text-white tracking-tight uppercase">
                  FIND A MATCH
                </h2>
                <p className="mt-0.5 text-xs font-body text-slate-400">
                  Choose your arena settings.
                </p>
              </div>

              {/* Category Segmented Controls */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  CATEGORY
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat
                    return (
                      <button
                        key={cat}
                        type="button"
                        disabled={isQueuing}
                        onClick={() => setSelectedCategory(cat)}
                        className={`p-2.5 rounded-lg border text-left font-mono text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#ffd43b]/10 border-[#ffd43b] text-[#ffd43b] font-bold'
                            : 'bg-[#0e2438] border-white/10 text-slate-300 hover:border-white/20'
                        } ${isQueuing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {cat}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Questions & Time per Question */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Questions */}
                <div className="space-y-2">
                  <label className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                    QUESTIONS
                  </label>
                  <div className="flex items-center gap-2">
                    {QUESTION_COUNTS.map((cnt) => {
                      const isSelected = selectedQuestionCount === cnt
                      return (
                        <button
                          key={cnt}
                          type="button"
                          disabled={isQueuing}
                          onClick={() => setSelectedQuestionCount(cnt)}
                          className={`flex-1 py-2 rounded-lg border font-mono text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#ffd43b] text-[#071a2b] border-[#ffd43b]'
                              : 'bg-[#0e2438] border-white/10 text-slate-300 hover:border-white/20'
                          } ${isQueuing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {cnt}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Time Per Question */}
                <div className="space-y-2">
                  <label className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                    TIME / QUESTION
                  </label>
                  <div className="flex items-center gap-2">
                    {TIMER_OPTIONS.map((t) => {
                      const isSelected = selectedTimer === t
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={isQueuing}
                          onClick={() => setSelectedTimer(t)}
                          className={`flex-1 py-2 rounded-lg border font-mono text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#ffd43b] text-[#071a2b] border-[#ffd43b]'
                              : 'bg-[#0e2438] border-white/10 text-slate-300 hover:border-white/20'
                          } ${isQueuing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {t}s
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Primary Action / Matchmaking State */}
              <div className="pt-2">
                {!isQueuing ? (
                  <button
                    type="button"
                    onClick={handleJoinQueue}
                    className="w-full py-3 bg-[#ffd43b] hover:bg-[#facc15] text-[#071a2b] rounded-lg font-display font-bold text-xs uppercase tracking-wider shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Swords className="w-4 h-4" />
                    <span>FIND MATCH</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-lg bg-[#0e2438] border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex items-center justify-center">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping absolute" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 relative" />
                        </div>
                        <div>
                          <div className="font-display font-bold text-xs uppercase tracking-wider text-amber-300">
                            {queueMessage || 'SEARCHING FOR OPPONENT'}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                            {selectedCategory} • {selectedQuestionCount} Questions • {selectedTimer}s
                          </div>
                        </div>
                      </div>

                      <div className="font-mono text-lg font-bold text-[#ffd43b] tabular-nums">
                        {formatTime(queueElapsed)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLeaveQueue}
                      className="w-full py-2 bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/20 rounded-lg font-mono text-xs font-semibold transition-all cursor-pointer"
                    >
                      CANCEL SEARCH
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Match Format */}
            <div className="lg:col-span-4 bg-[#0c1d2d] border border-white/10 rounded-xl p-5 space-y-4 shadow-sm h-fit">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <ShieldCheck className="w-4 h-4 text-[#ffd43b]" />
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  MATCH FORMAT
                </h3>
              </div>

              <div className="space-y-3 font-mono text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-white font-semibold block">3–10 Questions</span>
                    <span className="text-[11px] text-slate-400">Head-to-head aptitude problems.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Timer className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-white font-semibold block">Server-authoritative timer</span>
                    <span className="text-[11px] text-slate-400">Synchronized server match clock.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Zap className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-white font-semibold block">Real-time scoring</span>
                    <span className="text-[11px] text-slate-400">Instant validation & progress sync.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Award className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-white font-semibold block">Winner + XP after completion</span>
                    <span className="text-[11px] text-slate-400">+50 WIN • +20 DRAW • +5 LOSS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CHALLENGE COMPETITOR                                               */}
        {/* ========================================================================= */}
        {currentTab === 'challenge' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Competitor Search & Configuration */}
            <div className="lg:col-span-8 bg-[#0c1d2d] border border-white/10 rounded-xl p-5 sm:p-6 space-y-5 shadow-sm">
              <div>
                <h2 className="font-display font-bold text-base sm:text-lg text-white tracking-tight uppercase">
                  CHALLENGE A COMPETITOR
                </h2>
                <p className="mt-0.5 text-xs font-body text-slate-400">
                  Search an Apticks user or pick from your friends list.
                </p>
              </div>

              {/* Selected Competitor Pill */}
              {selectedCompetitor ? (
                <div className="p-3.5 rounded-lg bg-[#ffd43b]/10 border border-[#ffd43b]/40 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#071a2b] border border-white/15 flex items-center justify-center font-display font-bold text-white overflow-hidden shrink-0">
                      {selectedCompetitor.avatar_url ? (
                        <img src={selectedCompetitor.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        selectedCompetitor.username[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-xs text-white truncate">
                        {selectedCompetitor.display_name || selectedCompetitor.username}
                      </div>
                      <div className="font-mono text-[11px] text-[#ffd43b]">
                        @{selectedCompetitor.username}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedCompetitor(null)}
                    className="px-2.5 py-1 rounded bg-black/30 hover:bg-black/50 text-slate-300 hover:text-white border border-white/10 text-xs font-mono transition-all cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search username..."
                      className="w-full bg-[#0e2438] border border-white/15 rounded-lg pl-10 pr-10 py-2.5 font-mono text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#ffd43b]"
                    />
                    {searchingUsers && (
                      <RefreshCw className="w-3.5 h-3.5 text-[#ffd43b] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {/* Compact Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-1 p-1.5 bg-[#0e2438] border border-white/10 rounded-lg max-h-48 overflow-y-auto">
                      {searchResults.map((usr) => (
                        <div
                          key={usr.id}
                          className="p-2 rounded hover:bg-white/5 flex items-center justify-between gap-3 text-left transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-md bg-black/40 border border-white/10 flex items-center justify-center font-mono text-xs font-bold text-white overflow-hidden shrink-0">
                              {usr.avatar_url ? <img src={usr.avatar_url} alt="" /> : usr.username[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="font-mono text-xs text-white font-semibold block truncate">
                                @{usr.username}
                              </span>
                              {usr.display_name && (
                                <span className="font-body text-[11px] text-slate-400 block truncate">
                                  {usr.display_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedCompetitor(usr)}
                            className="px-2.5 py-1 bg-[#ffd43b] hover:bg-[#facc15] text-[#071a2b] rounded font-display font-bold text-[11px] uppercase tracking-wider shrink-0 transition-all cursor-pointer"
                          >
                            CHALLENGE
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Friends Quick Picker */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>FRIENDS ({friends.length})</span>
                    </div>

                    {friendsLoading ? (
                      <div className="py-4 text-center font-mono text-xs text-slate-500">
                        Loading friends...
                      </div>
                    ) : friends.length === 0 ? (
                      <div className="py-4 text-center font-mono text-xs text-slate-500 bg-[#0e2438] rounded-lg border border-white/5">
                        No friends found. Search a username above or connect in Social.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                        {friends.map((f) => (
                          <div
                            key={f.id}
                            className="p-2.5 rounded-lg bg-[#0e2438] border border-white/10 flex items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-md bg-[#071a2b] border border-white/10 flex items-center justify-center font-mono text-xs font-bold text-white overflow-hidden shrink-0">
                                {f.avatar_url ? <img src={f.avatar_url} alt="" /> : f.username[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-mono text-xs font-semibold text-white truncate">
                                  @{f.username}
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  Lvl {f.level}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedCompetitor({
                                id: f.id,
                                username: f.username,
                                display_name: f.display_name,
                                avatar_url: f.avatar_url,
                                level: f.level,
                              })}
                              className="px-2 py-1 bg-white/10 hover:bg-[#ffd43b] hover:text-[#071a2b] text-white rounded font-mono text-[11px] font-semibold uppercase tracking-wider shrink-0 transition-all cursor-pointer"
                            >
                              Select
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Match Configuration for Direct Challenge */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                {/* Category Selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                    CATEGORY
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CATEGORIES.map((cat) => {
                      const isSelected = selectedCategory === cat
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`p-2.5 rounded-lg border text-left font-mono text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#ffd43b]/10 border-[#ffd43b] text-[#ffd43b] font-bold'
                              : 'bg-[#0e2438] border-white/10 text-slate-300 hover:border-white/20'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Question Count & Timer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                      QUESTIONS
                    </label>
                    <div className="flex items-center gap-2">
                      {QUESTION_COUNTS.map((cnt) => {
                        const isSelected = selectedQuestionCount === cnt
                        return (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setSelectedQuestionCount(cnt)}
                            className={`flex-1 py-2 rounded-lg border font-mono text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#ffd43b] text-[#071a2b] border-[#ffd43b]'
                                : 'bg-[#0e2438] border-white/10 text-slate-300 hover:border-white/20'
                            }`}
                          >
                            {cnt}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                      TIME / QUESTION
                    </label>
                    <div className="flex items-center gap-2">
                      {TIMER_OPTIONS.map((t) => {
                        const isSelected = selectedTimer === t
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setSelectedTimer(t)}
                            className={`flex-1 py-2 rounded-lg border font-mono text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#ffd43b] text-[#071a2b] border-[#ffd43b]'
                                : 'bg-[#0e2438] border-white/10 text-slate-300 hover:border-white/20'
                            }`}
                          >
                            {t}s
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Submit Challenge CTA */}
                <button
                  type="button"
                  disabled={!selectedCompetitor || issuingChallenge}
                  onClick={handleSendChallenge}
                  className="w-full py-3 bg-[#ffd43b] hover:bg-[#facc15] disabled:opacity-40 text-[#071a2b] rounded-lg font-display font-bold text-xs uppercase tracking-wider shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <Swords className="w-4 h-4" />
                  <span>{issuingChallenge ? 'DISPATCHING CHALLENGE...' : 'ISSUE 1V1 CHALLENGE'}</span>
                </button>
              </div>
            </div>

            {/* Right Column: Challenger Info */}
            <div className="lg:col-span-4 bg-[#0c1d2d] border border-white/10 rounded-xl p-5 space-y-3 shadow-sm h-fit">
              <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                <Swords className="w-4 h-4 text-[#ffd43b]" />
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  DIRECT CHALLENGES
                </h3>
              </div>
              <p className="font-body text-xs text-slate-300 leading-relaxed">
                Direct challenges dispatch a pending invitation to your opponent with a 24-hour expiration window.
              </p>
              <p className="font-body text-xs text-slate-400 leading-relaxed">
                Once accepted, both players are routed immediately into the battle lobby to synchronize and begin.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PENDING CHALLENGES (COMPACT LIST ROWS)                             */}
        {/* ========================================================================= */}
        {currentTab === 'pending' && (
          <div className="space-y-5">
            {/* Incoming Challenges */}
            <div className="bg-[#0c1d2d] border border-white/10 rounded-xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-bold text-sm uppercase tracking-wider text-white">
                    INCOMING CHALLENGES
                  </h2>
                  <span className="px-1.5 py-0.2 rounded bg-[#ffd43b] text-[#071a2b] text-[10px] font-mono font-bold">
                    {incoming.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={fetchChallenges}
                  disabled={loadingChallenges}
                  className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 border border-white/10 transition-all cursor-pointer"
                  title="Refresh challenges"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingChallenges ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {incoming.length === 0 ? (
                <div className="py-6 text-center font-mono text-xs text-slate-500 bg-[#0e2438] rounded-lg border border-white/5">
                  No incoming challenges right now.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {incoming.map((ch) => (
                    <div
                      key={ch.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#071a2b] border border-white/15 flex items-center justify-center font-display font-bold text-white overflow-hidden shrink-0">
                          {ch.challenger.avatar_url ? (
                            <img src={ch.challenger.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            ch.challenger.username[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-white font-semibold flex items-center gap-2 flex-wrap">
                            <span>@{ch.challenger.username}</span>
                            <span className="text-[11px] text-slate-400 font-normal">wants to challenge you</span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                            {ch.category} • {ch.question_count} Qs • {ch.time_per_question_seconds}s/Q
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={actionMatchId === ch.id}
                          onClick={() => handleAccept(ch.id)}
                          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>ACCEPT</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionMatchId === ch.id}
                          onClick={() => handleDecline(ch.id)}
                          className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5 text-rose-400" />
                          <span>DECLINE</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Challenges */}
            <div className="bg-[#0c1d2d] border border-white/10 rounded-xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <h2 className="font-display font-bold text-sm uppercase tracking-wider text-white">
                    OUTGOING CHALLENGES
                  </h2>
                  <span className="px-1.5 py-0.2 rounded bg-white/10 text-white text-[10px] font-mono font-bold">
                    {outgoing.length}
                  </span>
                </div>
              </div>

              {outgoing.length === 0 ? (
                <div className="py-6 text-center font-mono text-xs text-slate-500 bg-[#0e2438] rounded-lg border border-white/5">
                  No outgoing challenges sent.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {outgoing.map((ch) => (
                    <div
                      key={ch.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#071a2b] border border-white/15 flex items-center justify-center font-display font-bold text-white overflow-hidden shrink-0">
                          {ch.opponent.avatar_url ? (
                            <img src={ch.opponent.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            ch.opponent.username[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-white font-semibold flex items-center gap-2 flex-wrap">
                            <span>Challenge sent to @{ch.opponent.username}</span>
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono font-bold uppercase">
                              Waiting
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                            {ch.category} • {ch.question_count} Qs • {ch.time_per_question_seconds}s/Q
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={actionMatchId === ch.id}
                          onClick={() => handleCancel(ch.id)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 border border-white/10 hover:border-rose-500/20 rounded-lg font-mono text-xs font-semibold transition-all cursor-pointer"
                        >
                          CANCEL
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ACTIVE BATTLES (COMPACT COMPETITIVE ROWS)                          */}
        {/* ========================================================================= */}
        {currentTab === 'active' && (
          <div className="bg-[#0c1d2d] border border-white/10 rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="font-display font-bold text-sm uppercase tracking-wider text-white pb-2 border-b border-white/10">
              ACTIVE MATCHES
            </h2>

            {activeMatches.length === 0 ? (
              <div className="py-6 text-center font-mono text-xs text-slate-500 bg-[#0e2438] rounded-lg border border-white/5">
                No active battles at the moment.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {activeMatches.map((m) => (
                  <div
                    key={m.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#071a2b] border border-white/15 flex items-center justify-center font-display font-bold text-white overflow-hidden shrink-0">
                        {m.competitor.avatar_url ? (
                          <img src={m.competitor.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          m.competitor.username[0]?.toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="font-mono text-xs font-semibold text-white">
                          vs @{m.competitor.username}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          Status: <span className="text-emerald-400 font-bold uppercase">{m.status}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/1v1/${m.id}`)}
                      className="px-3.5 py-1.5 bg-[#ffd43b] hover:bg-[#facc15] text-[#071a2b] rounded-lg font-display font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shrink-0 self-end sm:self-center"
                    >
                      <span>CONTINUE</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </AppLayout>
  )
}
