import { useState, useEffect } from 'react'
import {
  Trophy,
  Search,
  Sparkles,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AppLayout from '../../components/layout/AppLayout'

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
    <AppLayout>
      <div className="space-y-4 sm:space-y-5 animate-entry">
        {/* ================================================= */}
        {/* TOP HERO HEADER                                   */}
        {/* ================================================= */}
        <section className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] p-4 sm:p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#ffd43b] text-black border border-[#0c1d2d] rounded-full px-2.5 py-0.5 text-[9px] font-mono font-black tracking-widest uppercase shadow-[1px_1px_0_#0c1d2d] mb-1.5">
              <Trophy className="w-3 h-3 text-black" />
              <span>GLOBAL STANDINGS // SEASON 01 PREVIEW</span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-black leading-tight">
              ARENA LEADERBOARD
            </h1>
            <p className="mt-1 text-xs font-body font-semibold text-black/70 max-w-xl">
              Track global and division rankings based on cumulative XP, solve speed, and accuracy consistency.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-[#e9f6ff] border-1.5 border-[#0c1d2d] rounded-xl px-3 py-1.5 font-mono font-black text-[11px]">
              SEASON 01 IN PROGRESS
            </span>
          </div>
        </section>

        {/* ================================================= */}
        {/* PODIUM DECK (TOP 3 ATHLETES)                      */}
        {/* ================================================= */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          {/* #2 Silver Podium */}
          {topThree[1] && (
            <div className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl p-3.5 sm:p-4 shadow-[4px_4px_0_#38aef0] flex flex-col items-center text-center order-2 md:order-1">
              <div className="w-8 h-8 bg-[#38aef0] text-black border border-[#0c1d2d] rounded-full flex items-center justify-center font-display font-black text-xs shadow-[1.5px_1.5px_0_#0c1d2d] mb-2">
                #2
              </div>
              <div className="w-12 h-12 rounded-full border-2 border-[#0c1d2d] bg-[#38aef0] shadow-[1.5px_1.5px_0_#0c1d2d] overflow-hidden mb-1.5">
                {topThree[1].avatarUrl && (
                  <img src={topThree[1].avatarUrl} alt={topThree[1].username} className="w-full h-full" />
                )}
              </div>
              <h3 className="font-display font-black text-base uppercase text-black">
                {topThree[1].displayName}
              </h3>
              <span className="font-mono text-[11px] font-bold text-[#2563eb]">
                @{topThree[1].username}
              </span>
              <div className="mt-2.5 w-full py-1.5 bg-[#f8fafc] border-1.5 border-[#0c1d2d] rounded-xl font-mono font-black text-xs text-black">
                {topThree[1].points} XP
              </div>
            </div>
          )}

          {/* #1 Gold Podium (Dominant) */}
          {topThree[0] && (
            <div className="bg-[#ffd43b] border-2 sm:border-2 border-[#0c1d2d] rounded-xl p-4 sm:p-5 shadow-[3px_3px_0_#0c1d2d] flex flex-col items-center text-center order-1 md:order-2 md:-translate-y-1.5">
              <div className="inline-flex items-center gap-1 bg-[#ff5b5b] text-white border border-[#0c1d2d] rounded-full px-2 py-0.2 font-display font-black text-[9px] uppercase shadow-[1px_1px_0_#0c1d2d] mb-1.5">
                <Sparkles className="w-3 h-3" />
                SEASON LEADER
              </div>
              <div className="w-9 h-9 bg-black text-[#ffd43b] border border-[#0c1d2d] rounded-full flex items-center justify-center font-display font-black text-sm shadow-[1.5px_1.5px_0_#0c1d2d] mb-2">
                #1
              </div>
              <div className="w-14 h-14 rounded-full border-2 border-[#0c1d2d] bg-white shadow-[2px_2px_0_#0c1d2d] overflow-hidden mb-1.5">
                {topThree[0].avatarUrl && (
                  <img src={topThree[0].avatarUrl} alt={topThree[0].username} className="w-full h-full" />
                )}
              </div>
              <h3 className="font-display font-black text-lg uppercase text-black">
                {topThree[0].displayName}
              </h3>
              <span className="font-mono text-xs font-black text-black/80">
                @{topThree[0].username}
              </span>
              <div className="mt-3 w-full py-2 bg-white border-1.5 border-[#0c1d2d] rounded-xl font-mono font-black text-sm text-black shadow-[1.5px_1.5px_0_#0c1d2d]">
                {topThree[0].points} XP
              </div>
            </div>
          )}

          {/* #3 Bronze Podium */}
          {topThree[2] && (
            <div className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl p-3.5 sm:p-4 shadow-[4px_4px_0_#32e875] flex flex-col items-center text-center order-3">
              <div className="w-8 h-8 bg-[#32e875] text-black border border-[#0c1d2d] rounded-full flex items-center justify-center font-display font-black text-xs shadow-[1.5px_1.5px_0_#0c1d2d] mb-2">
                #3
              </div>
              <div className="w-12 h-12 rounded-full border-2 border-[#0c1d2d] bg-[#32e875] shadow-[1.5px_1.5px_0_#0c1d2d] overflow-hidden mb-1.5">
                {topThree[2].avatarUrl && (
                  <img src={topThree[2].avatarUrl} alt={topThree[2].username} className="w-full h-full" />
                )}
              </div>
              <h3 className="font-display font-black text-base uppercase text-black">
                {topThree[2].displayName}
              </h3>
              <span className="font-mono text-xs font-bold text-[#2563eb]">
                @{topThree[2].username}
              </span>
              <div className="mt-3 w-full py-2 bg-[#f8fafc] border-2 border-[#0c1d2d] rounded-xl font-mono font-black text-sm text-black">
                {topThree[2].points} XP
              </div>
            </div>
          )}
        </section>

        {/* ================================================= */}
        {/* SEARCH & TIMEFRAME TABS                           */}
        {/* ================================================= */}
        <div className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[3px_3px_0_#0c1d2d] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {[
              { id: 'weekly', label: 'WEEKLY' },
              { id: 'monthly', label: 'MONTHLY' },
              { id: 'alltime', label: 'SEASON 01 ALL-TIME' },
            ].map((scope) => (
              <button
                key={scope.id}
                type="button"
                onClick={() => setActiveScope(scope.id as 'weekly' | 'monthly' | 'alltime')}
                className={`
                  px-3.5 py-1.5 border-2 border-[#0c1d2d] rounded-xl font-display font-black text-xs uppercase cursor-pointer transition-all
                  ${
                    activeScope === scope.id
                      ? 'bg-[#ffd43b] text-black shadow-[2px_2px_0_#0c1d2d] -translate-y-0.5'
                      : 'bg-white text-black/70 hover:bg-slate-100'
                  }
                `}
              >
                {scope.label}
              </button>
            ))}
          </div>

          <div className="flex-1 max-w-xs flex items-center bg-white border-2 border-[#0c1d2d] rounded-xl shadow-[2px_2px_0_#0c1d2d] overflow-hidden">
            <span className="px-2.5 text-black">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search athlete or handle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2 px-1 outline-none font-display font-bold text-xs bg-transparent placeholder:text-black/35"
            />
          </div>
        </div>

        {/* ================================================= */}
        {/* RANKINGS TABLE                                    */}
        {/* ================================================= */}
        <div className="bg-white border-2 sm:border-2 border-[#0c1d2d] rounded-xl shadow-[8px_8px_0_#000000] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0c1d2d] text-white border-b-2 border-[#0c1d2d] font-mono text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-4 text-center w-16">RANK</th>
                  <th className="py-3.5 px-4">ATHLETE IDENTITY</th>
                  <th className="py-3.5 px-4 text-center">DIVISION</th>
                  <th className="py-3.5 px-4 text-center">SOLVED</th>
                  <th className="py-3.5 px-4 text-center">ACCURACY</th>
                  <th className="py-3.5 px-6 text-right">TOTAL XP</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/15 font-body">
                {filteredRankings.map((p) => {
                  const isCurrentUser = p.username === currentUserHandle

                  return (
                    <tr
                      key={p.rank}
                      className={`hover:bg-[#f8fafc] transition-colors ${
                        isCurrentUser ? 'bg-[#fffde7] font-bold' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border-2 border-[#0c1d2d] font-mono font-black text-xs ${
                            p.rank === 1
                              ? 'bg-[#ffd43b] text-black'
                              : p.rank === 2
                              ? 'bg-[#38aef0] text-black'
                              : p.rank === 3
                              ? 'bg-[#32e875] text-black'
                              : 'bg-slate-100 text-black'
                          }`}
                        >
                          #{p.rank}
                        </span>
                      </td>

                      {/* Identity */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#f1f5f9] border-2 border-[#0c1d2d] overflow-hidden flex items-center justify-center font-display font-black text-xs shrink-0">
                            {p.avatarUrl ? (
                              <img src={p.avatarUrl} alt={p.username} className="w-full h-full object-cover" />
                            ) : (
                              p.displayName.charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="font-display font-black text-sm text-black uppercase">
                              {p.displayName}
                              {isCurrentUser && (
                                <span className="ml-2 px-2 py-0.5 bg-[#ffd43b] text-black border border-[#0c1d2d] rounded text-[9px] font-mono font-black">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-xs font-bold text-black/60">
                              @{p.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Division */}
                      <td className="py-4 px-4 text-center">
                        <span className="bg-[#f1f5f9] border-2 border-[#0c1d2d] rounded-full px-2.5 py-0.5 text-[10px] font-mono font-black uppercase">
                          {p.division}
                        </span>
                      </td>

                      {/* Solved */}
                      <td className="py-4 px-4 text-center font-mono font-bold text-xs">
                        {p.solvedCount}
                      </td>

                      {/* Accuracy */}
                      <td className="py-4 px-4 text-center font-mono font-bold text-xs">
                        {p.accuracy}%
                      </td>

                      {/* Total XP */}
                      <td className="py-4 px-6 text-right font-mono font-black text-sm text-black">
                        {p.points} XP
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-[#faf9f6] border-t-2 border-[#0c1d2d] flex items-center justify-between text-xs font-mono font-bold text-black/60">
            <span>SHOWING SEASON 01 PREVIEW FIXTURES</span>
            <span>RANKINGS REFRESH AT 00:00 UTC</span>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
