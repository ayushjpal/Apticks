import { useState, useEffect } from 'react'
import {
  Trophy,
  Search,
  Sparkles,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AppLayout from '../../components/layout/AppLayout'
import { PageHeader, NeoBadge } from '../../components/ui'

interface LeaderboardPlayer {
  rank: number
  username: string
  displayName: string
  points: number
  solvedCount: number
  accuracy: number
  division: string
  avatarUrl?: string
}

const MOCK_LEADERBOARD: LeaderboardPlayer[] = [
  {
    rank: 1,
    username: 'speed_solver',
    displayName: 'Aarav Mehta',
    points: 4850,
    solvedCount: 142,
    accuracy: 94,
    division: 'Master',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=AaravM&backgroundColor=ffd43b',
  },
  {
    rank: 2,
    username: 'quant_queen',
    displayName: 'Priya Sharma',
    points: 4520,
    solvedCount: 138,
    accuracy: 91,
    division: 'Master',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=PriyaS&backgroundColor=38aef0',
  },
  {
    rank: 3,
    username: 'logic_legend',
    displayName: 'Rohan Verma',
    points: 4210,
    solvedCount: 125,
    accuracy: 89,
    division: 'Master',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=RohanV&backgroundColor=32e875',
  },
  {
    rank: 4,
    username: 'algo_ace',
    displayName: 'Sneha Patel',
    points: 3950,
    solvedCount: 118,
    accuracy: 88,
    division: 'Diamond',
  },
  {
    rank: 5,
    username: 'matrix_mind',
    displayName: 'Vikram Singh',
    points: 3720,
    solvedCount: 110,
    accuracy: 86,
    division: 'Diamond',
  },
  {
    rank: 6,
    username: 'turbo_coder',
    displayName: 'Ananya Roy',
    points: 3480,
    solvedCount: 104,
    accuracy: 85,
    division: 'Diamond',
  },
  {
    rank: 7,
    username: 'data_dynamo',
    displayName: 'Kabir Das',
    points: 3190,
    solvedCount: 96,
    accuracy: 83,
    division: 'Platinum',
  },
  {
    rank: 8,
    username: 'nexus_solver',
    displayName: 'Divya Nair',
    points: 2950,
    solvedCount: 88,
    accuracy: 82,
    division: 'Platinum',
  },
]

export default function Leaderboard() {
  const [activeScope, setActiveScope] = useState<'weekly' | 'monthly' | 'alltime'>('alltime')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentUserHandle, setCurrentUserHandle] = useState<string>('player')

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const handle = user.user_metadata?.username || user.email?.split('@')[0] || 'player'
        setCurrentUserHandle(handle)
      }
    }
    loadUser()
  }, [])

  const topThree = MOCK_LEADERBOARD.slice(0, 3)
  const filteredRankings = MOCK_LEADERBOARD.filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      p.username.toLowerCase().includes(q) ||
      p.displayName.toLowerCase().includes(q) ||
      p.division.toLowerCase().includes(q)
    )
  })

  return (
    <AppLayout maxWidth="narrow">
      <div className="space-y-4 sm:space-y-5 animate-entry">
        {/* ================================================= */}
        {/* TOP HERO HEADER                                   */}
        {/* ================================================= */}
        <PageHeader
          eyebrow="Global Standings"
          eyebrowIcon={<Trophy className="w-3.5 h-3.5 text-amber-600" />}
          title="Arena Leaderboard"
          description="Track global and division rankings based on cumulative XP, solve speed, and accuracy consistency."
          badge={
            <span className="bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 font-mono font-semibold text-[11px] text-slate-700">
              Season 01 In Progress
            </span>
          }
        />

        {/* ================================================= */}
        {/* PODIUM DECK (COMPACT TOP 3)                       */}
        {/* ================================================= */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
          {/* #2 Silver Podium */}
          {topThree[1] && (
            <div className="bg-white border border-[#0c1d2d]/12 rounded-xl p-4 shadow-xs flex flex-col items-center text-center order-2 md:order-1">
              <div className="w-6 h-6 bg-slate-100 text-slate-700 border border-slate-300 rounded-full flex items-center justify-center font-mono font-bold text-xs mb-1.5">
                #2
              </div>
              <div className="w-10 h-10 rounded-full border border-slate-200 bg-sky-50 overflow-hidden mb-1.5">
                {topThree[1].avatarUrl && (
                  <img src={topThree[1].avatarUrl} alt={topThree[1].username} className="w-full h-full" />
                )}
              </div>
              <h3 className="font-bold text-sm text-slate-900">
                {topThree[1].displayName}
              </h3>
              <span className="font-mono text-[11px] text-slate-500">
                @{topThree[1].username}
              </span>
              <div className="mt-2.5 w-full py-1 bg-slate-50 border border-slate-200/70 rounded-lg font-mono font-bold text-xs text-slate-800">
                {topThree[1].points} XP
              </div>
            </div>
          )}

          {/* #1 Gold Podium */}
          {topThree[0] && (
            <div className="bg-white border border-amber-300 ring-1 ring-amber-300/50 rounded-xl p-4 sm:p-4.5 shadow-sm flex flex-col items-center text-center order-1 md:order-2 md:-translate-y-1">
              <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-200/80 rounded-full px-2 py-0.5 font-mono font-bold text-[10px] mb-1.5">
                <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                <span>Leader</span>
              </div>
              <div className="w-6 h-6 bg-amber-100 text-amber-900 border border-amber-300 rounded-full flex items-center justify-center font-mono font-bold text-xs mb-1.5">
                #1
              </div>
              <div className="w-11 h-11 rounded-full border border-amber-300 bg-amber-50 overflow-hidden mb-1.5">
                {topThree[0].avatarUrl && (
                  <img src={topThree[0].avatarUrl} alt={topThree[0].username} className="w-full h-full" />
                )}
              </div>
              <h3 className="font-bold text-base text-slate-900">
                {topThree[0].displayName}
              </h3>
              <span className="font-mono text-xs text-slate-500">
                @{topThree[0].username}
              </span>
              <div className="mt-2.5 w-full py-1 bg-amber-50/60 border border-amber-200/70 rounded-lg font-mono font-bold text-xs text-amber-950">
                {topThree[0].points} XP
              </div>
            </div>
          )}

          {/* #3 Bronze Podium */}
          {topThree[2] && (
            <div className="bg-white border border-[#0c1d2d]/12 rounded-xl p-4 shadow-xs flex flex-col items-center text-center order-3">
              <div className="w-6 h-6 bg-amber-50 text-amber-800 border border-amber-200 rounded-full flex items-center justify-center font-mono font-bold text-xs mb-1.5">
                #3
              </div>
              <div className="w-10 h-10 rounded-full border border-slate-200 bg-emerald-50 overflow-hidden mb-1.5">
                {topThree[2].avatarUrl && (
                  <img src={topThree[2].avatarUrl} alt={topThree[2].username} className="w-full h-full" />
                )}
              </div>
              <h3 className="font-bold text-sm text-slate-900">
                {topThree[2].displayName}
              </h3>
              <span className="font-mono text-[11px] text-slate-500">
                @{topThree[2].username}
              </span>
              <div className="mt-2.5 w-full py-1 bg-slate-50 border border-slate-200/70 rounded-lg font-mono font-bold text-xs text-slate-800">
                {topThree[2].points} XP
              </div>
            </div>
          )}
        </section>

        {/* ================================================= */}
        {/* SEARCH & TIMEFRAME TABS                           */}
        {/* ================================================= */}
        <div className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-xs p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'weekly', label: 'Weekly' },
              { id: 'monthly', label: 'Monthly' },
              { id: 'alltime', label: 'Season All-Time' },
            ].map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => setActiveScope(scope.id as 'weekly' | 'monthly' | 'alltime')}
                className={`
                  px-3 py-1.5 border rounded-lg text-xs font-semibold cursor-pointer transition-colors
                  ${
                    activeScope === scope.id
                      ? 'bg-[#ffd43b] text-[#0c1d2d] border-amber-400/80 font-bold shadow-xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200'
                  }
                `}
              >
                {scope.label}
              </button>
            ))}
          </div>

          <div className="flex-1 max-w-xs flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search competitor or handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full outline-none font-medium text-xs bg-transparent text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* ================================================= */}
        {/* RANKINGS TABLE                                    */}
        {/* ================================================= */}
        <div className="bg-white border border-[#0c1d2d]/12 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-4 text-center w-14">Rank</th>
                  <th className="py-2.5 px-4">Competitor</th>
                  <th className="py-2.5 px-4 text-center">Division</th>
                  <th className="py-2.5 px-4 text-center">Solved</th>
                  <th className="py-2.5 px-4 text-center">Accuracy</th>
                  <th className="py-2.5 px-6 text-right">Total XP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRankings.map((p) => {
                  const isCurrentUser = p.username === currentUserHandle

                  return (
                    <tr
                      key={p.rank}
                      className={`hover:bg-slate-50 transition-colors ${
                        isCurrentUser ? 'bg-amber-50/40 font-medium' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-md font-mono font-bold text-[11px] ${
                            p.rank === 1
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : p.rank === 2
                              ? 'bg-slate-200 text-slate-800 border border-slate-300'
                              : p.rank === 3
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'text-slate-600'
                          }`}
                        >
                          #{p.rank}
                        </span>
                      </td>

                      {/* Identity */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-[11px] text-slate-700 shrink-0">
                            {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt={p.username} className="w-full h-full object-cover" />
                            ) : (
                              p.displayName.charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                              <span>{p.displayName}</span>
                              {isCurrentUser && (
                                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-mono font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              @{p.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Division */}
                      <td className="py-2.5 px-4 text-center">
                        <NeoBadge variant="outline" density="xs">
                          {p.division}
                        </NeoBadge>
                      </td>

                      {/* Solved */}
                      <td className="py-2.5 px-4 text-center font-mono font-medium text-xs text-slate-700">
                        {p.solvedCount}
                      </td>

                      {/* Accuracy */}
                      <td className="py-2.5 px-4 text-center font-mono font-medium text-xs text-slate-700">
                        {p.accuracy}%
                      </td>

                      {/* Total XP */}
                      <td className="py-2.5 px-6 text-right font-mono font-bold text-xs text-slate-900">
                        {p.points} XP
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500">
            <span>Showing Season 01 Preview Standings</span>
            <span>Rankings refresh daily at 00:00 UTC</span>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
