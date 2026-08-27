import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trophy,
  Users,
  Flame,
  ArrowRight,
  Zap,
  Calendar,
  CheckCircle2,
  Award,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'

interface ContestItem {
  id: string
  title: string
  category: string
  status: 'live' | 'upcoming' | 'completed'
  startTime: string
  durationMinutes: number
  questionCount: number
  participantsCount: number
  xpPool: number
  difficulty: 'Beginner' | 'Open' | 'Master'
  isRegistered?: boolean
}

const MOCK_CONTESTS: ContestItem[] = [
  {
    id: 'c-live-01',
    title: 'APTICKS SPEED CLASH #14',
    category: 'Quantitative & Speed Arithmetic',
    status: 'live',
    startTime: 'LIVE NOW',
    durationMinutes: 30,
    questionCount: 15,
    participantsCount: 248,
    xpPool: 2500,
    difficulty: 'Open',
    isRegistered: true,
  },
  {
    id: 'c-up-01',
    title: 'WEEKEND GRAND PRIX: LOGICAL DOMINANCE',
    category: 'Puzzles, Seating Arrangements & Deductions',
    status: 'upcoming',
    startTime: 'Saturday, 8:00 PM IST',
    durationMinutes: 45,
    questionCount: 25,
    participantsCount: 412,
    xpPool: 5000,
    difficulty: 'Master',
    isRegistered: false,
  },
  {
    id: 'c-up-02',
    title: 'DATA INTERPRETATION SPRINT #06',
    category: 'Tables, Bar Charts & Pie Visualizations',
    status: 'upcoming',
    startTime: 'Sunday, 4:00 PM IST',
    durationMinutes: 25,
    questionCount: 12,
    participantsCount: 180,
    xpPool: 1800,
    difficulty: 'Beginner',
    isRegistered: false,
  },
  {
    id: 'c-comp-01',
    title: 'APTICKS SPEED CLASH #13',
    category: 'Percentages, Profit & Loss',
    status: 'completed',
    startTime: 'Yesterday',
    durationMinutes: 30,
    questionCount: 15,
    participantsCount: 389,
    xpPool: 2500,
    difficulty: 'Open',
    isRegistered: true,
  },
]

export default function Contests() {
  const navigate = useNavigate()
  const [contests, setContests] = useState<ContestItem[]>(MOCK_CONTESTS)
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all')

  const handleToggleRegister = (contestId: string) => {
    setContests((prev) =>
      prev.map((c) =>
        c.id === contestId ? { ...c, isRegistered: !c.isRegistered } : c
      )
    )
  }

  const liveContest = contests.find((c) => c.status === 'live')
  const filteredContests = contests.filter((c) => {
    if (activeTab === 'all') return true
    return c.status === activeTab
  })

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-5 animate-entry">
        {/* ================================================= */}
        {/* TOP CONTEST ARENA HERO                            */}
        {/* ================================================= */}
        <section className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-[5px_5px_0_#38aef0] p-4 sm:p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#ffd43b] text-black border border-black rounded-full px-2.5 py-0.5 text-[9px] font-mono font-black tracking-widest uppercase shadow-[1px_1px_0_#000000] mb-1.5">
              <Trophy className="w-3 h-3 text-black" />
              <span>ARENA CONTESTS // SEASON 01 PREVIEW</span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-black leading-tight">
              SPEED TOURNAMENTS
            </h1>
            <p className="mt-1 text-xs font-body font-semibold text-black/70 max-w-xl">
              Compete synchronously against top aptitude solvers in scheduled timed clashes. Win XP and Division rankings.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="bg-[#f1f5f9] border-1.5 border-black rounded-xl px-3 py-1.5 font-mono font-black text-[11px]">
              SEASON 01 ACTIVE
            </span>
          </div>
        </section>

        {/* ================================================= */}
        {/* LIVE CLASH ARENA BANNER (IF ACTIVE)               */}
        {/* ================================================= */}
        {liveContest && (
          <section className="bg-[#ffd43b] border-2 sm:border-3 border-black rounded-2xl shadow-[5px_5px_0_#000000] p-4 sm:p-5 lg:p-6 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="bg-[#ff5b5b] text-white border border-black rounded-full px-2.5 py-0.5 font-display font-black text-[9px] uppercase shadow-[1px_1px_0_#000000] flex items-center gap-1 animate-pulse">
                    <Flame className="w-3 h-3 fill-white" />
                    LIVE TOURNAMENT ROUND
                  </span>
                  <span className="bg-white border border-black rounded-full px-2 py-0.5 font-mono text-[9px] font-black uppercase">
                    [ SEASON 01 PREVIEW ]
                  </span>
                </div>

                <h2 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight text-black">
                  {liveContest.title}
                </h2>
                <p className="text-xs font-body font-semibold text-black/80 max-w-lg">
                  {liveContest.category} • 15 questions in 30 minutes. Real-time scoring and penalty deductions.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] font-black">
                  <span className="bg-white border-1.5 border-black rounded-lg px-2 py-0.5 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {liveContest.participantsCount} SOLVERS
                  </span>
                  <span className="bg-black text-white border-1.5 border-black rounded-lg px-2 py-0.5 flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-[#ffd43b] text-[#ffd43b]" />
                    {liveContest.xpPool} XP PRIZE POOL
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/questions/quant-001')}
                  className="px-6 py-2.5 bg-[#ff5b5b] hover:bg-[#ef4444] text-white border-2 border-black rounded-xl shadow-[3px_3px_0_#000000] font-display font-black text-xs uppercase tracking-wider transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5 fill-white" />
                  <span>ENTER LIVE ARENA →</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ================================================= */}
        {/* TAB FILTER CONTROLS                               */}
        {/* ================================================= */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {[
            { id: 'all', label: 'ALL TOURNAMENTS' },
            { id: 'live', label: 'LIVE NOW' },
            { id: 'upcoming', label: 'UPCOMING FIXTURES' },
            { id: 'completed', label: 'PAST ARCHIVES' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'all' | 'live' | 'upcoming' | 'completed')}
              className={`
                px-3 py-1.5 border-2 border-black rounded-xl font-display font-black text-[11px] sm:text-xs uppercase tracking-wider whitespace-nowrap cursor-pointer transition-all
                ${
                  activeTab === tab.id
                    ? 'bg-[#ffd43b] text-black shadow-[2px_2px_0_#000000] -translate-y-0.5'
                    : 'bg-white text-black/80 hover:bg-[#e9f6ff] shadow-[1.5px_1.5px_0_#000000]'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ================================================= */}
        {/* CONTESTS GRID DECK                                */}
        {/* ================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredContests.map((c) => (
            <div
              key={c.id}
              className="bg-white border-3 sm:border-4 border-black rounded-2xl shadow-[6px_6px_0_#000000] p-5 sm:p-6 flex flex-col justify-between"
            >
              <div>
                {/* Top badges */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {c.status === 'live' && (
                      <span className="bg-[#ff5b5b] text-white border-2 border-black rounded-full px-2.5 py-0.5 text-[9px] font-display font-black uppercase">
                        LIVE NOW
                      </span>
                    )}
                    {c.status === 'upcoming' && (
                      <span className="bg-[#38aef0] text-black border-2 border-black rounded-full px-2.5 py-0.5 text-[9px] font-display font-black uppercase">
                        SCHEDULED
                      </span>
                    )}
                    {c.status === 'completed' && (
                      <span className="bg-slate-200 text-black border-2 border-black rounded-full px-2.5 py-0.5 text-[9px] font-display font-black uppercase">
                        ARCHIVED
                      </span>
                    )}
                    <span className="bg-[#f8fafc] border border-black rounded-full px-2 py-0.5 font-mono text-[9px] font-bold text-black/70">
                      [ PREVIEW ]
                    </span>
                  </div>

                  <span className="font-mono text-xs font-black text-black">
                    +{c.xpPool} XP
                  </span>
                </div>

                <h3 className="font-display font-black text-lg sm:text-xl uppercase text-black leading-tight">
                  {c.title}
                </h3>
                <p className="mt-1 text-xs font-body font-semibold text-black/65">
                  {c.category}
                </p>

                {/* Specs */}
                <div className="mt-4 grid grid-cols-3 gap-2 p-3 bg-[#f8fafc] border-2 border-black rounded-xl text-center">
                  <div>
                    <div className="font-mono text-[10px] font-bold text-black/60 uppercase">
                      START
                    </div>
                    <div className="font-display font-black text-xs text-black mt-0.5 truncate">
                      {c.startTime}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] font-bold text-black/60 uppercase">
                      LENGTH
                    </div>
                    <div className="font-display font-black text-xs text-black mt-0.5">
                      {c.durationMinutes}m • {c.questionCount}Q
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] font-bold text-black/60 uppercase">
                      SOLVERS
                    </div>
                    <div className="font-display font-black text-xs text-black mt-0.5">
                      {c.participantsCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="mt-5 pt-4 border-t-2 border-black flex items-center justify-between gap-3">
                {c.status === 'live' ? (
                  <button
                    type="button"
                    onClick={() => navigate('/questions/quant-001')}
                    className="w-full py-2.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>ENTER TOURNAMENT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : c.status === 'upcoming' ? (
                  <button
                    type="button"
                    onClick={() => handleToggleRegister(c.id)}
                    className={`w-full py-2.5 border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      c.isRegistered
                        ? 'bg-[#32e875] text-black'
                        : 'bg-white hover:bg-[#e9f6ff] text-black'
                    }`}
                  >
                    {c.isRegistered ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>REGISTERED [✓]</span>
                      </>
                    ) : (
                      <>
                        <Calendar className="w-3.5 h-3.5" />
                        <span>REGISTER FOR CLASH</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/leaderboard')}
                    className="w-full py-2.5 bg-white hover:bg-slate-100 border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>VIEW RESULTS & STANDINGS</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
