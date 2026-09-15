import { useState, useEffect } from 'react'
import {
  Trophy,
  Search,
  Zap,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AppLayout from '../../components/layout/AppLayout'
import { PageHeader, RankMedalBadge } from '../../components/ui'
import { LeaderboardService } from '../../services/leaderboardService'
import type {
  GlobalLeaderboardEntry,
  UserGlobalRankResult,
} from '../../types/leaderboard'

const TOP_LIMIT = 10

export default function Leaderboard() {
  // Current logged in user
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserHandle, setCurrentUserHandle] = useState<string>('')
  const [userRankData, setUserRankData] = useState<UserGlobalRankResult | null>(null)

  // Global Leaderboard State (Top 10 competitors)
  const [globalEntries, setGlobalEntries] = useState<GlobalLeaderboardEntry[]>([])
  const [globalLoading, setGlobalLoading] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // ---------------------------------------------------------------------------
  // 1. Load Current User Session
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function loadUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          setCurrentUserId(user.id)
          const handle =
            user.user_metadata?.username || user.email?.split('@')[0] || 'player'
          setCurrentUserHandle(handle)
        }
      } catch (err) {
        console.warn('Leaderboard auth check note:', err)
      }
    }
    loadUser()
  }, [])

  // ---------------------------------------------------------------------------
  // 2. Fetch Global Leaderboard Data & User Rank
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    const fetchGlobal = async () => {
      setGlobalLoading(true)
      setGlobalError(null)

      // Request only Top 10 competitors
      const response = await LeaderboardService.getGlobalLeaderboard(TOP_LIMIT, 0)

      if (!isMounted) return

      if (response.success) {
        setGlobalEntries(response.leaderboard)
      } else {
        setGlobalError(
          response.error ||
            'Unable to load global rankings. Please refresh or try again.'
        )
        setGlobalEntries([])
      }

      setGlobalLoading(false)
    }

    fetchGlobal()

    return () => {
      isMounted = false
    }
  }, [refreshKey])

  // Fetch current user's individual rank standing (for the sticky HUD card)
  useEffect(() => {
    let isMounted = true

    async function fetchUserRank() {
      if (!currentUserId) return
      const rankRes = await LeaderboardService.getUserGlobalRank(currentUserId)
      if (isMounted && rankRes.found) {
        setUserRankData(rankRes)
      }
    }

    if (currentUserId) {
      fetchUserRank()
    }

    return () => {
      isMounted = false
    }
  }, [currentUserId, globalEntries])

  // ---------------------------------------------------------------------------
  // Helper calculations
  // ---------------------------------------------------------------------------
  // Filtered entries in Top 10
  const filteredGlobalEntries = globalEntries.filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      p.username.toLowerCase().includes(q) ||
      p.displayName.toLowerCase().includes(q)
    )
  })

  // Top 3 Podium (Only displayed when not searching and at least 2 competitors exist)
  const topThree =
    !searchQuery.trim() && globalEntries.length > 0
      ? globalEntries.slice(0, 3)
      : []

  // Below the podium: show only ranks #4 through #10 (or matching search results)
  const displayTableEntries = searchQuery.trim()
    ? filteredGlobalEntries
    : topThree.length >= 2
    ? globalEntries.slice(3, 10)
    : globalEntries

  return (
    <AppLayout maxWidth="narrow">
      <div className="space-y-4 sm:space-y-5 animate-entry pb-12">
        {/* ================================================= */}
        {/* TOP HERO HEADER                                   */}
        {/* ================================================= */}
        <PageHeader
          eyebrow="Apticks Competitive Standings"
          eyebrowIcon={<Trophy className="w-3.5 h-3.5 text-amber-600" />}
          title="Arena Leaderboard"
          description="Global competitive rankings based on unified XP and player performance."
          badge={
            <span className="bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 font-mono font-semibold text-[11px] text-slate-700">
              Season 01 Active
            </span>
          }
        />

        {/* ================================================= */}
        {/* TOOLBAR: SEARCH & REFRESH                         */}
        {/* ================================================= */}
        <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-xl shadow-xs p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 px-2 py-1">
            <Trophy className="w-4 h-4 text-[#ffd43b] shrink-0" />
            <span className="font-display font-bold text-xs uppercase tracking-wider text-white">
              Global Arena Standings
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search competitor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full outline-none font-medium text-xs bg-transparent text-white placeholder:text-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Refresh rankings"
              aria-label="Refresh rankings"
              className="p-2 border border-white/10 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${globalLoading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* ================================================= */}
        {/* CURRENT USER POSITION HUD                         */}
        {/* ================================================= */}
        {currentUserId && userRankData && (
          <div className="bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 border border-amber-200/90 border-l-4 border-l-[#ffd43b] rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#0c1d2d] text-[#ffd43b] border border-[#0c1d2d] flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-xs">
                #{String(userRankData.rank).padStart(2, '0')}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-black text-sm text-[#0c1d2d]">
                    Your Current Standing
                  </span>
                  <span className="px-1.5 py-0.2 bg-[#ffd43b] text-[#0c1d2d] border border-[#0c1d2d]/20 rounded text-[9px] font-mono font-black uppercase tracking-wider">
                    You
                  </span>
                </div>
                <div className="font-mono text-xs text-slate-600 flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="font-semibold text-slate-800">@{userRankData.username || currentUserHandle}</span>
                  <span>•</span>
                  <span className="font-semibold text-[#0c1d2d]">
                    LVL {String(userRankData.level).padStart(2, '0')} ({userRankData.levelTitle || 'Novice'})
                  </span>
                  <span>•</span>
                  <span>{userRankData.solvedCount} Solved</span>
                  <span>•</span>
                  <span>{userRankData.accuracyPercentage}% Acc</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 font-mono">
              <div className="px-3.5 py-1.5 bg-white border border-amber-200/90 rounded-lg shadow-2xs text-right">
                <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">
                  Total XP
                </span>
                <span className="text-xs font-black text-[#0c1d2d] flex items-center gap-1.5 justify-end">
                  <Zap className="w-3.5 h-3.5 fill-[#ffd43b] text-[#0c1d2d]" />
                  <span>{userRankData.totalXp} XP</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* GLOBAL STANDINGS                                  */}
        {/* ================================================= */}
        <div className="space-y-4">
            {/* Top 3 Podium Deck (Glossy Competitive Arena Tier) */}
            {topThree.length >= 2 && !globalLoading && (
              <div className="relative pt-1 pb-1">
                {/* Contained Ambient Arena Lighting behind Podium */}
                <div className="absolute inset-0 -top-4 -bottom-4 pointer-events-none select-none flex justify-around opacity-70 blur-2xl">
                  <div className="w-52 h-44 rounded-full bg-cyan-500/15" />
                  <div className="w-64 h-52 rounded-full bg-purple-600/25 -translate-y-3" />
                  <div className="w-52 h-44 rounded-full bg-amber-500/15" />
                </div>

                <section className="relative grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
                  {/* #2 Left Podium — Glossy Diamond / Ice Blue */}
                  {topThree[1] && (
                    <div className="order-2 md:order-1 relative group overflow-hidden rounded-2xl p-4.5 flex flex-col items-center text-center bg-gradient-to-b from-[#112445]/95 via-[#0a1b38]/92 to-[#050f22]/98 backdrop-blur-md border border-cyan-400/45 hover:border-cyan-300/80 shadow-[0_6px_28px_-3px_rgba(6,182,212,0.32),0_0_0_1px_rgba(103,232,249,0.15),inset_0_1px_2px_rgba(255,255,255,0.22),inset_0_-2px_6px_rgba(0,0,0,0.45)] hover:shadow-[0_10px_38px_rgba(6,182,212,0.48),0_0_0_1px_rgba(103,232,249,0.3),inset_0_1px_2px_rgba(255,255,255,0.32)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01]">
                      {/* Crystalline Gloss & Multi-Layer Light Reflections */}
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(103,232,249,0.25),transparent_75%)] pointer-events-none rounded-2xl" />
                      <div className="absolute top-0 inset-x-5 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-200/90 to-transparent pointer-events-none" />
                      <div className="absolute -inset-px rounded-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.09)_0%,transparent_38%,rgba(6,182,212,0.07)_65%,transparent_100%)] pointer-events-none" />

                      {/* Rank Medal Badge (#02 Diamond) */}
                      <div className="relative mb-2 flex items-center justify-center">
                        <RankMedalBadge rank={2} size="md" />
                      </div>

                      {/* Avatar */}
                      <div className="relative mb-2 flex items-center justify-center">
                        <div className="relative w-11 h-11 rounded-full border-2 border-cyan-300/90 ring-2 ring-cyan-400/30 bg-cyan-950/85 overflow-hidden flex items-center justify-center font-bold text-xs text-cyan-200 shadow-md">
                          {topThree[1].avatarUrl ? (
                            <img
                              src={topThree[1].avatarUrl}
                              alt={topThree[1].username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            topThree[1].displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                      </div>

                      {/* Name & Handle */}
                      <h3 className="relative font-display font-bold text-xs text-white truncate max-w-full">
                        {topThree[1].displayName}
                      </h3>
                      <span className="relative font-mono text-[10px] text-cyan-200/75 truncate max-w-full">
                        @{topThree[1].username}
                      </span>

                      {/* Icy Blue / Silver Glass XP Footer */}
                      <div className="relative mt-2.5 w-full py-1.5 px-3 bg-gradient-to-r from-cyan-950/85 via-[#0c223f]/75 to-cyan-950/85 border border-cyan-400/45 rounded-xl font-mono font-bold text-xs text-cyan-100 flex items-center justify-center gap-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_2px_10px_rgba(6,182,212,0.22)] group-hover:border-cyan-300/60 transition-colors">
                        <Zap className="w-3 h-3 text-cyan-300 fill-cyan-300 drop-shadow-[0_0_5px_rgba(6,182,212,0.65)]" />
                        <span className="text-white font-black">{topThree[1].totalXp} XP</span>
                      </div>
                    </div>
                  )}

                  {/* #1 Center Podium — Glossy Purple / Champion */}
                  {topThree[0] && (
                    <div className="order-1 md:order-2 md:-translate-y-3 relative group overflow-hidden rounded-2xl p-5 flex flex-col items-center text-center bg-gradient-to-b from-[#2a1354]/95 via-[#1a0c36]/92 to-[#0e0520]/98 backdrop-blur-md border border-purple-400/55 hover:border-purple-300/85 shadow-[0_8px_36px_-3px_rgba(168,85,247,0.45),0_0_0_1px_rgba(192,132,252,0.2),inset_0_1px_2px_rgba(255,255,255,0.28),inset_0_-2px_8px_rgba(0,0,0,0.55)] hover:shadow-[0_12px_48px_rgba(168,85,247,0.6),0_0_0_1px_rgba(192,132,252,0.35),inset_0_1px_2px_rgba(255,255,255,0.38)] transition-all duration-300 hover:-translate-y-4 hover:scale-[1.02]">
                      {/* Gloss & Controlled Center Luminous Light Overlays */}
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_65%_at_50%_0%,rgba(192,132,252,0.32),transparent_75%)] pointer-events-none rounded-2xl" />
                      <div className="absolute top-0 inset-x-6 h-[1.5px] bg-gradient-to-r from-transparent via-purple-200/95 to-transparent pointer-events-none" />
                      <div className="absolute -inset-px rounded-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.1)_0%,transparent_38%,rgba(168,85,247,0.08)_65%,transparent_100%)] pointer-events-none" />

                      {/* Rank Medal Badge (#01 Champion) */}
                      <div className="relative mb-2 flex items-center justify-center">
                        <RankMedalBadge rank={1} size="lg" />
                      </div>

                      {/* Avatar */}
                      <div className="relative mb-2.5 flex items-center justify-center">
                        <div className="relative w-13 h-13 rounded-full border-2 border-purple-300 ring-2 ring-amber-400/50 bg-purple-950/90 overflow-hidden flex items-center justify-center font-bold text-sm text-purple-200 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                          {topThree[0].avatarUrl ? (
                            <img
                              src={topThree[0].avatarUrl}
                              alt={topThree[0].username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            topThree[0].displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                      </div>

                      {/* Name & Handle */}
                      <h3 className="relative font-display font-black text-sm text-white truncate max-w-full drop-shadow-xs">
                        {topThree[0].displayName}
                      </h3>
                      <span className="relative font-mono text-[11px] text-purple-300/85 truncate max-w-full">
                        @{topThree[0].username}
                      </span>

                      {/* Purple Glass XP Footer with Gold Lightning */}
                      <div className="relative mt-3 w-full py-2 px-3.5 bg-gradient-to-r from-purple-950/85 via-purple-900/65 to-purple-950/85 border border-purple-500/50 rounded-xl font-mono font-black text-xs text-purple-100 flex items-center justify-center gap-1.5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.15),0_2px_14px_rgba(168,85,247,0.3)] group-hover:border-purple-400/70 transition-colors">
                        <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]" />
                        <span className="text-white font-black tracking-tight">{topThree[0].totalXp} XP</span>
                      </div>
                    </div>
                  )}

                  {/* #3 Right Podium — Glossy Gold */}
                  {topThree[2] && (
                    <div className="order-3 relative group overflow-hidden rounded-2xl p-4.5 flex flex-col items-center text-center bg-gradient-to-b from-[#2c1e0a]/95 via-[#1e1406]/92 to-[#0e0903]/98 backdrop-blur-md border border-amber-400/45 hover:border-amber-300/80 shadow-[0_6px_28px_-3px_rgba(245,158,11,0.32),0_0_0_1px_rgba(252,211,77,0.15),inset_0_1px_2px_rgba(255,255,255,0.22),inset_0_-2px_6px_rgba(0,0,0,0.45)] hover:shadow-[0_10px_38px_rgba(245,158,11,0.48),0_0_0_1px_rgba(252,211,77,0.3),inset_0_1px_2px_rgba(255,255,255,0.32)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01]">
                      {/* Metallic Gloss & Warm Golden Reflections */}
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(245,158,11,0.25),transparent_75%)] pointer-events-none rounded-2xl" />
                      <div className="absolute top-0 inset-x-5 h-[1.5px] bg-gradient-to-r from-transparent via-amber-200/90 to-transparent pointer-events-none" />
                      <div className="absolute -inset-px rounded-2xl bg-[linear-gradient(135deg,rgba(255,255,255,0.09)_0%,transparent_38%,rgba(245,158,11,0.07)_65%,transparent_100%)] pointer-events-none" />

                      {/* Rank Medal Badge (#03 Gold) */}
                      <div className="relative mb-2 flex items-center justify-center">
                        <RankMedalBadge rank={3} size="md" />
                      </div>

                      {/* Avatar */}
                      <div className="relative mb-2 flex items-center justify-center">
                        <div className="relative w-11 h-11 rounded-full border-2 border-amber-300/90 ring-2 ring-amber-400/30 bg-amber-950/85 overflow-hidden flex items-center justify-center font-bold text-xs text-amber-200 shadow-md">
                          {topThree[2].avatarUrl ? (
                            <img
                              src={topThree[2].avatarUrl}
                              alt={topThree[2].username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            topThree[2].displayName.charAt(0).toUpperCase()
                          )}
                        </div>
                      </div>

                      {/* Name & Handle */}
                      <h3 className="relative font-display font-bold text-xs text-white truncate max-w-full">
                        {topThree[2].displayName}
                      </h3>
                      <span className="relative font-mono text-[10px] text-amber-200/75 truncate max-w-full">
                        @{topThree[2].username}
                      </span>

                      {/* Dark Gold / Bronze Glass XP Footer */}
                      <div className="relative mt-2.5 w-full py-1.5 px-3 bg-gradient-to-r from-amber-950/85 via-[#291a05]/75 to-amber-950/85 border border-amber-400/45 rounded-xl font-mono font-bold text-xs text-amber-100 flex items-center justify-center gap-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_2px_10px_rgba(245,158,11,0.22)] group-hover:border-amber-300/60 transition-colors">
                        <Zap className="w-3 h-3 text-amber-400 fill-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.65)]" />
                        <span className="text-white font-black">{topThree[2].totalXp} XP</span>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* Main Standings Table */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-xl shadow-xs overflow-hidden">
              {globalLoading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-[#ffd43b] rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs font-mono text-slate-400">
                    Loading authoritative global standings...
                  </p>
                </div>
              ) : globalError ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-white">
                    Standings Sync Error
                  </h4>
                  <p className="text-xs font-mono text-slate-400 mt-1 max-w-md mx-auto">
                    {globalError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRefreshKey((k) => k + 1)}
                    className="mt-3 px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    Retry Loading
                  </button>
                </div>
              ) : globalEntries.length === 0 ? (
                <div className="p-10 text-center">
                  <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-white">
                    No Ranked Competitors Yet
                  </h4>
                  <p className="text-xs font-mono text-slate-400 mt-1 max-w-md mx-auto">
                    Global rankings populate dynamically as competitors solve practice questions, daily challenges, and tournaments.
                  </p>
                </div>
              ) : displayTableEntries.length === 0 ? (
                <div className="p-10 text-center">
                  <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-white">
                    {searchQuery ? 'No matching competitors' : 'Top 3 Featured Above'}
                  </h4>
                  <p className="text-xs font-mono text-slate-400 mt-1 max-w-md mx-auto">
                    {searchQuery
                      ? `No competitor matches "${searchQuery}" in the Top 10.`
                      : 'All ranked competitors are featured on the podium above. Ranks #4 through #10 will appear here as more competitors join.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#0c1d2d] text-slate-400 border-b border-white/10 font-mono text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3.5 text-center w-14">Rank</th>
                        <th className="py-2.5 px-3.5">Competitor</th>
                        <th className="py-2.5 px-3.5 text-center">Level</th>
                        <th className="py-2.5 px-3.5 text-center">Solved</th>
                        <th className="py-2.5 px-3.5 text-center">Accuracy</th>
                        <th className="py-2.5 px-3.5 text-center">Tournaments</th>
                        <th className="py-2.5 px-5 text-right">Unified Total XP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-body text-xs">
                      {displayTableEntries.map((entry) => {
                        const isCurrentUser =
                          currentUserId && entry.userId === currentUserId

                        return (
                          <tr
                            key={entry.userId}
                            className={`hover:bg-white/[0.04] transition-colors border-b border-white/5 ${
                              isCurrentUser
                                ? 'bg-amber-400/10 border-l-4 border-l-[#ffd43b] font-medium'
                                : ''
                            }`}
                          >
                            {/* Rank */}
                            <td className="py-2.5 px-3.5 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-7 h-6 rounded-md font-mono font-bold text-xs ${
                                  entry.rank === 1
                                    ? 'bg-[#ffd43b] text-[#0c1d2d] border border-[#0c1d2d]/20'
                                    : entry.rank === 2
                                    ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                    : entry.rank === 3
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'text-slate-300 font-bold'
                                }`}
                              >
                                #{String(entry.rank).padStart(2, '0')}
                              </span>
                            </td>

                            {/* Competitor Identity */}
                            <td className="py-2.5 px-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 overflow-hidden flex items-center justify-center font-bold text-[11px] text-slate-200 shrink-0">
                                  {entry.avatarUrl ? (
                                    <img
                                      src={entry.avatarUrl}
                                      alt={entry.username}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    entry.displayName.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-xs text-white flex items-center gap-1.5 truncate">
                                    <span className="truncate">{entry.displayName}</span>
                                    {isCurrentUser && (
                                      <span className="px-1.5 py-0.2 bg-[#ffd43b] text-[#0c1d2d] border border-[#0c1d2d]/20 rounded text-[9px] font-mono font-black uppercase tracking-wider shrink-0">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[10px] text-slate-400 truncate">
                                    @{entry.username}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Level */}
                            <td className="py-2.5 px-3.5 text-center">
                              <span className="inline-block px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-400/25 rounded font-mono font-bold text-[10px]">
                                LVL {String(entry.level).padStart(2, '0')}
                              </span>
                              {entry.levelTitle && (
                                <div className="text-[9px] font-mono font-bold text-slate-400 uppercase mt-0.5">
                                  {entry.levelTitle}
                                </div>
                              )}
                            </td>

                            {/* Solved */}
                            <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-200">
                              {entry.solvedCount}
                            </td>

                            {/* Accuracy */}
                            <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-200">
                              {entry.accuracyPercentage}%
                            </td>

                            {/* Tournaments Completed */}
                            <td className="py-2.5 px-3.5 text-center font-mono font-medium text-slate-300">
                              {entry.contestsCount}
                            </td>

                            {/* Total XP */}
                            <td className="py-2.5 px-5 text-right font-mono font-black">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-400/25 rounded-md text-orange-400 text-xs">
                                <Zap className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                                <span>{entry.totalXp} XP</span>
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Standings Summary Footer */}
              <div className="p-3 bg-slate-900/60 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Top 10 Global Arena Standings</span>
                </span>
                <span className="text-slate-500">Tie-break: XP &gt; Solved &gt; Accuracy &gt; Seniority</span>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }
