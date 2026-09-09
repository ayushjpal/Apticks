import { useState, useEffect } from 'react'
import {
  Trophy,
  Search,
  Sparkles,
  Zap,
  RefreshCw,
  AlertCircle,
  Medal,
  Swords,
  Layers,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AppLayout from '../../components/layout/AppLayout'
import { PageHeader, NeoBadge, StatusBadge } from '../../components/ui'
import { LeaderboardService } from '../../services/leaderboardService'
import type {
  GlobalLeaderboardEntry,
  UserGlobalRankResult,
  LeaderboardViewMode,
} from '../../types/leaderboard'
import type { Contest, ContestLeaderboardEntry } from '../../types/contests'

const TOP_LIMIT = 10

export default function Leaderboard() {
  // Mode: Global Arena Standings vs Tournament Standings
  const [viewMode, setViewMode] = useState<LeaderboardViewMode>('global')

  // Current logged in user
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserHandle, setCurrentUserHandle] = useState<string>('')
  const [userRankData, setUserRankData] = useState<UserGlobalRankResult | null>(null)

  // Global Leaderboard State (Top 10 competitors)
  const [globalEntries, setGlobalEntries] = useState<GlobalLeaderboardEntry[]>([])
  const [globalLoading, setGlobalLoading] = useState(true)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Contest Leaderboard State
  const [contests, setContests] = useState<Contest[]>([])
  const [selectedContestId, setSelectedContestId] = useState<string>('')
  const [contestEntries, setContestEntries] = useState<ContestLeaderboardEntry[]>([])
  const [contestLoading, setContestLoading] = useState(false)
  const [contestError, setContestError] = useState<string | null>(null)

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

  const [refreshKey, setRefreshKey] = useState(0)

  // ---------------------------------------------------------------------------
  // 2. Fetch Global Leaderboard Data & User Rank
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    if (viewMode !== 'global') return

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
  }, [viewMode, refreshKey])

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
  // 3. Fetch Contests & Contest Leaderboard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true

    async function initContests() {
      if (viewMode !== 'contest') return
      setContestLoading(true)
      const list = await LeaderboardService.getContestsForLeaderboard()
      if (!isMounted) return

      setContests(list)
      if (list.length > 0) {
        setSelectedContestId(list[0].id)
      } else {
        setContestLoading(false)
      }
    }

    initContests()

    return () => {
      isMounted = false
    }
  }, [viewMode])

  useEffect(() => {
    let isMounted = true

    if (viewMode !== 'contest' || !selectedContestId) return

    const fetchContest = async () => {
      setContestLoading(true)
      setContestError(null)

      try {
        const entries = await LeaderboardService.getContestLeaderboard(selectedContestId)
        if (isMounted) {
          setContestEntries(entries)
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Unable to load tournament standings.'
          setContestError(msg)
          setContestEntries([])
        }
      } finally {
        if (isMounted) {
          setContestLoading(false)
        }
      }
    }

    fetchContest()

    return () => {
      isMounted = false
    }
  }, [viewMode, selectedContestId, refreshKey])

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

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const selectedContest = contests.find((c) => c.id === selectedContestId)

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
          description="Track global competitive rankings and tournament results based on unified XP, problem solving accuracy, and time efficiency."
          badge={
            <span className="bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 font-mono font-semibold text-[11px] text-slate-700">
              Season 01 Active
            </span>
          }
        />

        {/* ================================================= */}
        {/* CONTEXT SWITCHER: GLOBAL VS TOURNAMENT            */}
        {/* ================================================= */}
        <div className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs p-2 sm:p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-lg border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                setViewMode('global')
                setSearchQuery('')
              }}
              className={`
                px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5
                ${
                  viewMode === 'global'
                    ? 'bg-[#ffd43b] text-[#0c1d2d] shadow-xs font-bold border border-amber-400/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }
              `}
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              <span>Global Arena Standings</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setViewMode('contest')
                setSearchQuery('')
              }}
              className={`
                px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5
                ${
                  viewMode === 'contest'
                    ? 'bg-[#ffd43b] text-[#0c1d2d] shadow-xs font-bold border border-amber-400/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }
              `}
            >
              <Swords className="w-3.5 h-3.5 shrink-0" />
              <span>Tournament Standings</span>
            </button>
          </div>

          {/* Right Action / Search */}
          {viewMode === 'global' ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs w-full sm:w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search competitor..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full outline-none font-medium text-xs bg-transparent text-slate-800 placeholder:text-slate-400"
                />
              </div>

              <button
                type="button"
                onClick={() => setRefreshKey((k) => k + 1)}
                title="Refresh rankings"
                aria-label="Refresh rankings"
                className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${globalLoading ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          ) : (
            contests.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs font-medium text-slate-500 shrink-0">
                  Select Arena:
                </span>
                <select
                  value={selectedContestId}
                  onChange={(e) => setSelectedContestId(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none cursor-pointer w-full sm:w-auto"
                >
                  {contests.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.status})
                    </option>
                  ))}
                </select>
              </div>
            )
          )}
        </div>

        {/* ================================================= */}
        {/* CURRENT USER POSITION HUD (GLOBAL MODE ONLY)      */}
        {/* ================================================= */}
        {viewMode === 'global' && currentUserId && userRankData && (
          <div className="bg-gradient-to-r from-amber-50/70 to-amber-100/40 border border-amber-200/90 rounded-xl p-3 sm:p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#ffd43b] text-[#0c1d2d] border border-[#0c1d2d]/15 flex items-center justify-center font-mono font-bold text-xs shrink-0 shadow-xs">
                #{userRankData.rank}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    Your Current Standing
                  </span>
                  <span className="px-1.5 py-0.2 bg-amber-200/70 text-amber-900 border border-amber-300 rounded text-[9px] font-mono font-bold">
                    You
                  </span>
                </div>
                <div className="font-mono text-xs text-slate-600 flex items-center gap-2 mt-0.5 flex-wrap">
                  <span>@{userRankData.username || currentUserHandle}</span>
                  <span>•</span>
                  <span className="font-semibold text-slate-800">
                    Lvl {userRankData.level} ({userRankData.levelTitle || 'Novice'})
                  </span>
                  <span>•</span>
                  <span>{userRankData.solvedCount} Solved</span>
                  <span>•</span>
                  <span>{userRankData.accuracyPercentage}% Acc</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 font-mono">
              <div className="px-3 py-1 bg-white border border-amber-200/80 rounded-lg shadow-2xs text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">
                  Authoritative XP
                </span>
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1 justify-end">
                  <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                  {userRankData.totalXp} XP
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* VIEW MODE: GLOBAL STANDINGS                       */}
        {/* ================================================= */}
        {viewMode === 'global' && (
          <div className="space-y-4">
            {/* Top 3 Podium Deck (Compact, LeetCode-restrained) */}
            {topThree.length >= 2 && !globalLoading && (
              <section className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-1">
                {/* #2 Silver Podium */}
                {topThree[1] && (
                  <div className="bg-white border border-[#0c1d2d]/12 rounded-xl p-3.5 shadow-xs flex flex-col items-center text-center order-2 md:order-1">
                    <div className="w-5 h-5 bg-slate-100 text-slate-700 border border-slate-300 rounded-full flex items-center justify-center font-mono font-bold text-[10px] mb-1">
                      #2
                    </div>
                    <div className="w-9 h-9 rounded-full border border-slate-200 bg-sky-50 overflow-hidden mb-1 flex items-center justify-center font-bold text-xs text-slate-700">
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
                    <h3 className="font-bold text-xs text-slate-900 truncate max-w-full">
                      {topThree[1].displayName}
                    </h3>
                    <span className="font-mono text-[10px] text-slate-500 truncate max-w-full">
                      @{topThree[1].username}
                    </span>
                    <div className="mt-2 w-full py-1 bg-slate-50 border border-slate-200/70 rounded-md font-mono font-bold text-[11px] text-slate-800">
                      {topThree[1].totalXp} XP
                    </div>
                  </div>
                )}

                {/* #1 Gold Podium */}
                {topThree[0] && (
                  <div className="bg-white border border-amber-300 ring-1 ring-amber-300/40 rounded-xl p-4 shadow-xs flex flex-col items-center text-center order-1 md:order-2 md:-translate-y-1">
                    <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full px-2 py-0.2 font-mono font-bold text-[9px] mb-1">
                      <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                      <span>Leader</span>
                    </div>
                    <div className="w-6 h-6 bg-amber-100 text-amber-900 border border-amber-300 rounded-full flex items-center justify-center font-mono font-bold text-xs mb-1">
                      #1
                    </div>
                    <div className="w-10 h-10 rounded-full border border-amber-300 bg-amber-50 overflow-hidden mb-1 flex items-center justify-center font-bold text-sm text-amber-950">
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
                    <h3 className="font-bold text-sm text-slate-900 truncate max-w-full">
                      {topThree[0].displayName}
                    </h3>
                    <span className="font-mono text-[11px] text-slate-500 truncate max-w-full">
                      @{topThree[0].username}
                    </span>
                    <div className="mt-2 w-full py-1 bg-amber-50/80 border border-amber-200/70 rounded-md font-mono font-bold text-xs text-amber-950">
                      {topThree[0].totalXp} XP
                    </div>
                  </div>
                )}

                {/* #3 Bronze Podium */}
                {topThree[2] && (
                  <div className="bg-white border border-[#0c1d2d]/12 rounded-xl p-3.5 shadow-xs flex flex-col items-center text-center order-3">
                    <div className="w-5 h-5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full flex items-center justify-center font-mono font-bold text-[10px] mb-1">
                      #3
                    </div>
                    <div className="w-9 h-9 rounded-full border border-slate-200 bg-emerald-50 overflow-hidden mb-1 flex items-center justify-center font-bold text-xs text-slate-700">
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
                    <h3 className="font-bold text-xs text-slate-900 truncate max-w-full">
                      {topThree[2].displayName}
                    </h3>
                    <span className="font-mono text-[10px] text-slate-500 truncate max-w-full">
                      @{topThree[2].username}
                    </span>
                    <div className="mt-2 w-full py-1 bg-slate-50 border border-slate-200/70 rounded-md font-mono font-bold text-[11px] text-slate-800">
                      {topThree[2].totalXp} XP
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Main Standings Table */}
            <div className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs overflow-hidden">
              {globalLoading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-[#0c1d2d] rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs font-mono text-slate-500">
                    Loading authoritative global standings...
                  </p>
                </div>
              ) : globalError ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-slate-900">
                    Standings Sync Error
                  </h4>
                  <p className="text-xs font-mono text-slate-500 mt-1 max-w-md mx-auto">
                    {globalError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRefreshKey((k) => k + 1)}
                    className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
                  >
                    Retry Loading
                  </button>
                </div>
              ) : globalEntries.length === 0 ? (
                <div className="p-10 text-center">
                  <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-slate-900">
                    No Ranked Competitors Yet
                  </h4>
                  <p className="text-xs font-mono text-slate-500 mt-1 max-w-md mx-auto">
                    Global rankings populate dynamically as competitors solve practice questions, daily challenges, and tournaments.
                  </p>
                </div>
              ) : displayTableEntries.length === 0 ? (
                <div className="p-10 text-center">
                  <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-slate-900">
                    {searchQuery ? 'No matching competitors' : 'Top 3 Featured Above'}
                  </h4>
                  <p className="text-xs font-mono text-slate-500 mt-1 max-w-md mx-auto">
                    {searchQuery
                      ? `No competitor matches "${searchQuery}" in the Top 10.`
                      : 'All ranked competitors are featured on the podium above. Ranks #4 through #10 will appear here as more competitors join.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3.5 text-center w-14">Rank</th>
                        <th className="py-2.5 px-3.5">Competitor</th>
                        <th className="py-2.5 px-3.5 text-center">Level</th>
                        <th className="py-2.5 px-3.5 text-center">Solved</th>
                        <th className="py-2.5 px-3.5 text-center">Accuracy</th>
                        <th className="py-2.5 px-3.5 text-center">Tournaments</th>
                        <th className="py-2.5 px-5 text-right">Unified Total XP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {displayTableEntries.map((entry) => {
                        const isCurrentUser =
                          currentUserId && entry.userId === currentUserId

                        return (
                          <tr
                            key={entry.userId}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isCurrentUser
                                ? 'bg-amber-50/50 font-medium'
                                : ''
                            }`}
                          >
                            {/* Rank */}
                            <td className="py-2.5 px-3.5 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-mono font-bold text-[11px] ${
                                  entry.rank === 1
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : entry.rank === 2
                                    ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                    : entry.rank === 3
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'text-slate-600'
                                }`}
                              >
                                #{entry.rank}
                              </span>
                            </td>

                            {/* Competitor Identity */}
                            <td className="py-2.5 px-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-[11px] text-slate-700 shrink-0">
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
                                  <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5 truncate">
                                    <span className="truncate">{entry.displayName}</span>
                                    {isCurrentUser && (
                                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-mono font-bold shrink-0">
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
                              <NeoBadge variant="outline" density="xs">
                                Lvl {entry.level}
                              </NeoBadge>
                              {entry.levelTitle && (
                                <div className="text-[9px] font-mono font-bold text-slate-500 uppercase mt-0.5">
                                  {entry.levelTitle}
                                </div>
                              )}
                            </td>

                            {/* Solved */}
                            <td className="py-2.5 px-3.5 text-center font-mono font-medium text-slate-700">
                              {entry.solvedCount}
                            </td>

                            {/* Accuracy */}
                            <td className="py-2.5 px-3.5 text-center font-mono font-medium text-slate-700">
                              {entry.accuracyPercentage}%
                            </td>

                            {/* Tournaments Completed */}
                            <td className="py-2.5 px-3.5 text-center font-mono font-medium text-slate-600">
                              {entry.contestsCount}
                            </td>

                            {/* Total XP */}
                            <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-900">
                              <span className="inline-flex items-center gap-1">
                                <Zap className="w-3 h-3 fill-amber-500 text-amber-500" />
                                {entry.totalXp} XP
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
              <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs font-mono text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Top 10 Global Arena Standings</span>
                </span>
                <span>Tie-break: XP &gt; Solved &gt; Accuracy &gt; Seniority</span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* VIEW MODE: TOURNAMENT STANDINGS                   */}
        {/* ================================================= */}
        {viewMode === 'contest' && (
          <div className="space-y-4">
            {/* Contest Header Pill */}
            {selectedContest && (
              <div className="bg-white border border-[#0c1d2d]/12 rounded-xl p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={selectedContest.status} />
                    <h3 className="font-display font-bold text-sm text-[#0c1d2d]">
                      {selectedContest.title}
                    </h3>
                  </div>
                  <div className="font-mono text-xs text-slate-500">
                    Duration: {selectedContest.durationMinutes}m • Pool: {selectedContest.xpPool} XP
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
                    {contestEntries.length} Completed Submissions
                  </span>
                </div>
              </div>
            )}

            {/* Contest Standings Table */}
            <div className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs overflow-hidden">
              {contestLoading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-slate-200 border-t-[#0c1d2d] rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs font-mono text-slate-500">
                    Syncing tournament leaderboard...
                  </p>
                </div>
              ) : contestError ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-slate-900">
                    Tournament Leaderboard Error
                  </h4>
                  <p className="text-xs font-mono text-slate-500 mt-1 max-w-md mx-auto">
                    {contestError}
                  </p>
                  <button
                    type="button"
                    onClick={() => setRefreshKey((k) => k + 1)}
                    className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
                  >
                    Retry Loading
                  </button>
                </div>
              ) : contestEntries.length === 0 ? (
                <div className="p-10 text-center">
                  <Medal className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-slate-900">
                    No Submissions Yet
                  </h4>
                  <p className="text-xs font-mono text-slate-500 mt-1 max-w-md mx-auto">
                    Tournament rankings will populate dynamically as competitors submit their arena answers.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-2.5 px-3.5 text-center w-14">Rank</th>
                        <th className="py-2.5 px-3.5">Participant</th>
                        <th className="py-2.5 px-3.5 text-center">Score</th>
                        <th className="py-2.5 px-3.5 text-center">Time Spent</th>
                        <th className="py-2.5 px-3.5 text-center">Correct</th>
                        <th className="py-2.5 px-3.5 text-center">Accuracy</th>
                        <th className="py-2.5 px-5 text-right">XP Won</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {contestEntries.map((entry) => {
                        const isCurrentUser =
                          currentUserId && entry.userId === currentUserId

                        return (
                          <tr
                            key={entry.userId}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isCurrentUser ? 'bg-amber-50/50 font-medium' : ''
                            }`}
                          >
                            {/* Rank */}
                            <td className="py-2.5 px-3.5 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-mono font-bold text-[11px] ${
                                  entry.rank === 1
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : entry.rank === 2
                                    ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                    : entry.rank === 3
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'text-slate-600'
                                }`}
                              >
                                #{entry.rank}
                              </span>
                            </td>

                            {/* Participant */}
                            <td className="py-2.5 px-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-[11px] text-slate-700 shrink-0">
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
                                  <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5 truncate">
                                    <span className="truncate">{entry.displayName}</span>
                                    {isCurrentUser && (
                                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-mono font-bold shrink-0">
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

                            {/* Score */}
                            <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-900">
                              {entry.totalScore.toFixed(2)} pts
                            </td>

                            {/* Time Taken */}
                            <td className="py-2.5 px-3.5 text-center font-mono text-slate-600">
                              {formatSeconds(entry.timeTakenSeconds)}
                            </td>

                            {/* Correct Count */}
                            <td className="py-2.5 px-3.5 text-center font-mono text-slate-700">
                              {entry.correctAnswersCount}
                            </td>

                            {/* Accuracy */}
                            <td className="py-2.5 px-3.5 text-center font-mono text-slate-700">
                              {entry.accuracyPercentage}%
                            </td>

                            {/* XP Won */}
                            <td className="py-2.5 px-5 text-right font-mono font-bold text-amber-600">
                              +{entry.xpAwarded} XP
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs font-mono text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>Contest Engine authoritative standings</span>
                </span>
                <span>Tie-break: Score &gt; Time Taken &gt; Submission Time</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
