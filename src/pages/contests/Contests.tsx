import { useState, useEffect } from 'react'
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
  Loader2,
} from 'lucide-react'
import AppLayout from '../../components/layout/AppLayout'
import { ContestService } from '../../services/contestService'
import type { Contest } from '../../types/contests'
import { supabase } from '../../lib/supabase'

export default function Contests() {
  const navigate = useNavigate()
  const [contests, setContests] = useState<Contest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming' | 'completed'>('all')
  const [registeringId, setRegisteringId] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadContests = async () => {
      setLoading(true)
      try {
        const data = await ContestService.getContests()
        if (isMounted) {
          setContests(data)
        }
      } catch (err) {
        console.error('Failed to load contests:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadContests()

    return () => {
      isMounted = false
    }
  }, [])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleRegister = async (contestId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        navigate('/login', { state: { from: `/contests/${contestId}` } })
        return
      }

      setRegisteringId(contestId)
      const res = await ContestService.registerForContest(contestId)

      if (res.success) {
        setContests((prev) =>
          prev.map((c) =>
            c.id === contestId
              ? {
                  ...c,
                  isRegistered: true,
                  userStatus: 'registered',
                  participantsCount: (c.participantsCount || 0) + (res.alreadyRegistered ? 0 : 1),
                }
              : c
          )
        )
        showToast(res.message || 'Successfully registered!')
      } else {
        showToast(res.message || 'Registration failed.')
      }
    } catch (err) {
      console.error('Registration error:', err)
      showToast('Error registering for contest.')
    } finally {
      setRegisteringId(null)
    }
  }

  const formatStartTime = (startTimeStr: string, status: string) => {
    if (status === 'live') return 'LIVE NOW'
    try {
      const date = new Date(startTimeStr)
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return startTimeStr
    }
  }

  const liveContest = contests.find((c) => c.status === 'live')
  const filteredContests = contests.filter((c) => {
    if (activeTab === 'all') return true
    return c.status === activeTab
  })

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-5 animate-entry relative">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#ffd43b] text-black border-3 border-black p-3.5 rounded-xl shadow-[4px_4px_0_#000000] font-display font-black text-xs uppercase flex items-center gap-2 animate-bounce">
            <Zap className="w-4 h-4 fill-black" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ================================================= */}
        {/* TOP CONTEST ARENA HERO                            */}
        {/* ================================================= */}
        <section className="bg-white border-2 sm:border-3 border-black rounded-2xl shadow-[5px_5px_0_#38aef0] p-4 sm:p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-[#ffd43b] text-black border border-black rounded-full px-2.5 py-0.5 text-[9px] font-mono font-black tracking-widest uppercase shadow-[1px_1px_0_#000000] mb-1.5">
              <Trophy className="w-3 h-3 text-black" />
              <span>ARENA CONTESTS // SPEED TOURNAMENTS</span>
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
                    [ SPEED CLASH ]
                  </span>
                </div>

                <h2 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight text-black">
                  {liveContest.title}
                </h2>
                <p className="text-xs font-body font-semibold text-black/80 max-w-lg">
                  {liveContest.category} • {liveContest.totalQuestions} questions in {liveContest.durationMinutes} minutes. Real-time scoring and penalty deductions.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] font-black">
                  <span className="bg-white border-1.5 border-black rounded-lg px-2 py-0.5 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {liveContest.participantsCount || 0} SOLVERS
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
                  onClick={() => navigate(`/contests/${liveContest.id}`)}
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
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-black/40 mb-2" />
            <p className="font-mono text-xs font-bold text-black/60 uppercase">
              SYNCING ARENA CONTESTS...
            </p>
          </div>
        ) : filteredContests.length === 0 ? (
          <div className="p-8 bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0_#000000] text-center">
            <Trophy className="w-10 h-10 mx-auto text-black/30 mb-2" />
            <h3 className="font-display font-black text-lg uppercase text-black">
              NO CONTESTS IN THIS CATEGORY
            </h3>
            <p className="text-xs font-body font-semibold text-black/60 mt-1">
              Check other tabs or come back soon for newly scheduled tournament fixtures.
            </p>
          </div>
        ) : (
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
                      <span className="bg-[#f8fafc] border border-black rounded-full px-2 py-0.5 font-mono text-[9px] font-bold text-black/70 uppercase">
                        [{c.difficulty}]
                      </span>
                    </div>

                    <span className="font-mono text-xs font-black text-black">
                      +{c.xpPool} XP
                    </span>
                  </div>

                  <h3
                    onClick={() => navigate(`/contests/${c.id}`)}
                    className="font-display font-black text-lg sm:text-xl uppercase text-black leading-tight cursor-pointer hover:underline"
                  >
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
                        {formatStartTime(c.startTime, c.status)}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] font-bold text-black/60 uppercase">
                        LENGTH
                      </div>
                      <div className="font-display font-black text-xs text-black mt-0.5">
                        {c.durationMinutes}m • {c.totalQuestions}Q
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] font-bold text-black/60 uppercase">
                        SOLVERS
                      </div>
                      <div className="font-display font-black text-xs text-black mt-0.5">
                        {c.participantsCount || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action */}
                <div className="mt-5 pt-4 border-t-2 border-black flex items-center justify-between gap-3">
                  {c.status === 'live' ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/contests/${c.id}`)}
                      className="w-full py-2.5 bg-[#ffd43b] hover:bg-[#facc15] border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>ENTER TOURNAMENT</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : c.status === 'upcoming' ? (
                    <div className="w-full flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/contests/${c.id}`)}
                        className="py-2.5 px-3 bg-white hover:bg-slate-100 border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center justify-center cursor-pointer"
                      >
                        DETAILS
                      </button>
                      <button
                        type="button"
                        disabled={registeringId === c.id}
                        onClick={() => handleRegister(c.id)}
                        className={`flex-1 py-2.5 border-2 border-black rounded-xl font-display font-black text-xs uppercase shadow-[2px_2px_0_#000000] flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                          c.isRegistered
                            ? 'bg-[#32e875] text-black'
                            : 'bg-[#38aef0] hover:bg-[#209be2] text-black'
                        }`}
                      >
                        {registeringId === c.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : c.isRegistered ? (
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
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/contests/${c.id}/results`)}
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
        )}
      </div>
    </AppLayout>
  )
}
