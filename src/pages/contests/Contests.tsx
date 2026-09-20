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
import { PageHeader, StatusBadge } from '../../components/ui'
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
    <div className="max-w-[1160px] mx-auto space-y-4 sm:space-y-5 animate-entry relative">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#0c1d2d] text-white border border-slate-700 p-3.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
            <Zap className="w-4 h-4 text-[#ffd43b] fill-[#ffd43b]" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ================================================= */}
        {/* TOP CONTEST ARENA HERO                            */}
        {/* ================================================= */}
        <PageHeader
          eyebrow="Contest Arena"
          eyebrowIcon={<Trophy className="w-3.5 h-3.5 text-amber-600" />}
          title="Speed Tournaments"
          description="Compete synchronously against top aptitude solvers in scheduled timed clashes. Win XP and Division rankings."
          badge={
            <span className="bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 font-mono font-semibold text-[11px] text-slate-700">
              Season 01 Active
            </span>
          }
        />

        {/* ================================================= */}
        {/* LIVE CLASH ARENA BANNER (IF ACTIVE)               */}
        {/* ================================================= */}
        {liveContest && (
          <section className="bg-gradient-to-br from-[#0c1d2d] to-[#142d45] text-white border border-rose-500/40 ring-1 ring-rose-500/20 rounded-2xl shadow-sm p-5 sm:p-6 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <StatusBadge status="live" density="xs" />
                  <span className="bg-white/10 border border-white/15 text-slate-200 rounded px-2 py-0.5 font-mono text-[10px] font-semibold">
                    Speed Clash
                  </span>
                </div>

                <h2 className="font-bold text-xl sm:text-2xl text-white tracking-tight">
                  {liveContest.title}
                </h2>
                <p className="text-xs text-slate-300 max-w-lg">
                  {liveContest.category} • {liveContest.totalQuestions} questions in {liveContest.durationMinutes} minutes. Real-time scoring and penalty deductions.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
                  <span className="bg-white/10 border border-white/15 rounded-md px-2.5 py-0.5 flex items-center gap-1.5 text-slate-200">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{liveContest.participantsCount || 0} Solvers</span>
                  </span>
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-md px-2.5 py-0.5 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                    <span>{liveContest.xpPool} XP Prize Pool</span>
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/contests/${liveContest.id}`)}
                  className="px-5 py-2.5 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-lg shadow-xs font-bold text-xs uppercase tracking-wide transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5 text-[#0c1d2d]" />
                  <span>Enter Live Arena</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#0c1d2d]" />
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
            { id: 'all', label: 'All Fixtures' },
            { id: 'live', label: 'Live Now' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'all' | 'live' | 'upcoming' | 'completed')}
              className={`
                px-3 py-1.5 border rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors
                ${
                  activeTab === tab.id
                    ? 'bg-[#ffd43b] text-[#0c1d2d] border-amber-400/80 shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/80'
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
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-slate-400 mb-2" />
            <p className="font-mono text-xs text-slate-500">
              Syncing tournaments...
            </p>
          </div>
        ) : filteredContests.length === 0 ? (
          <div className="p-8 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl text-center">
            <Trophy className="w-9 h-9 mx-auto text-slate-500 mb-2" />
            <h3 className="font-bold text-base text-white">
              No Tournaments Found
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Check other tabs or come back soon for newly scheduled tournament fixtures.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            {filteredContests.map((c) => (
              <div
                key={c.id}
                className="bg-slate-900/60 backdrop-blur-md border border-white/10 hover:border-white/20 rounded-2xl p-5 sm:p-5.5 flex flex-col justify-between transition-all"
              >
                <div>
                  {/* Top badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={c.status} density="xs" />
                      <StatusBadge status={c.difficulty} density="xs" />
                    </div>

                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/30">
                      +{c.xpPool} XP
                    </span>
                  </div>

                  <h3
                    onClick={() => navigate(`/contests/${c.id}`)}
                    className="font-bold text-lg text-white leading-snug cursor-pointer hover:text-[#ffd43b] transition-colors"
                  >
                    {c.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 font-medium">
                    {c.category}
                  </p>

                  {/* Specs */}
                  <div className="mt-3.5 grid grid-cols-3 gap-2 p-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-center">
                    <div>
                      <div className="font-mono text-[10px] font-semibold text-slate-400 uppercase">
                        Start
                      </div>
                      <div className="font-semibold text-xs text-slate-200 mt-0.5 truncate">
                        {formatStartTime(c.startTime, c.status)}
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] font-semibold text-slate-400 uppercase">
                        Format
                      </div>
                      <div className="font-semibold text-xs text-slate-200 mt-0.5">
                        {c.durationMinutes}m • {c.totalQuestions}Q
                      </div>
                    </div>
                    <div>
                      <div className="font-mono text-[10px] font-semibold text-slate-400 uppercase">
                        Solvers
                      </div>
                      <div className="font-semibold text-xs text-slate-200 mt-0.5">
                        {c.participantsCount || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action */}
                <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between gap-2.5">
                  {c.status === 'live' ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/contests/${c.id}`)}
                      className="w-full py-2 px-4 bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 rounded-lg font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span>Enter Tournament</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#0c1d2d]" />
                    </button>
                  ) : c.status === 'upcoming' ? (
                    <div className="w-full flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/contests/${c.id}`)}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-semibold text-xs text-slate-300 hover:text-white shadow-xs flex items-center justify-center cursor-pointer transition-colors"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        disabled={registeringId === c.id}
                        onClick={() => handleRegister(c.id)}
                        className={`flex-1 py-2 border rounded-lg font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                          c.isRegistered
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border-amber-400/80'
                        }`}
                      >
                        {registeringId === c.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : c.isRegistered ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Registered</span>
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Register</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/contests/${c.id}/results`)}
                      className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-lg font-semibold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Award className="w-3.5 h-3.5 text-slate-400" />
                      <span>View Standings & Solutions</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
  )
}
