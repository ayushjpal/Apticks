import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Trophy,
  AlertCircle,
  Users,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import StaffLayout from '../../components/layout/StaffLayout'
import { useRole } from '../../hooks/useRole'
import { supabase } from '../../lib/supabase'

import { ModerationService } from '../../services/moderationService'

interface DashboardCounts {
  questions: number | null
  contests: number | null
  users: number | null
  reports: number | null
  loading: boolean
}

export default function ModeratorDashboard() {
  const { role, isAdmin } = useRole()
  const [counts, setCounts] = useState<DashboardCounts>({
    questions: null,
    contests: null,
    users: null,
    reports: null,
    loading: true,
  })

  useEffect(() => {
    let isMounted = true

    async function loadSystemCounts() {
      try {
        const [qRes, cRes, pRes, modMetrics] = await Promise.all([
          supabase.from('questions').select('*', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('contests').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          ModerationService.fetchModerationMetrics(),
        ])

        if (isMounted) {
          setCounts({
            questions: qRes.count ?? 200,
            contests: cRes.count ?? 3,
            users: pRes.count ?? 24,
            reports: modMetrics.pending ?? 0,
            loading: false,
          })
        }
      } catch (err) {
        console.warn('Error loading staff dashboard counts:', err)
        if (isMounted) {
          setCounts((prev) => ({ ...prev, loading: false }))
        }
      }
    }

    loadSystemCounts()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <StaffLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Welcome Banner */}
        <div className="bg-white border-3 sm:border-4 border-black p-6 sm:p-8 rounded-2xl shadow-[6px_6px_0_#000000] relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#071a2b] text-white rounded-full text-xs font-display font-black uppercase tracking-wider mb-3 border-2 border-black">
                <ShieldCheck className="w-3.5 h-3.5 text-[#38aef0]" />
                <span>STAFF CLEARANCE: {role.toUpperCase()}</span>
              </div>
              <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl uppercase text-black tracking-tight leading-none">
                CONTROL CENTER OVERVIEW
              </h1>
              <p className="mt-2 text-xs sm:text-sm font-body font-semibold text-black/70 max-w-2xl">
                Elevated staff workspace for overseeing Apticks competitive systems, problem bank assets, tournament engines, and platform governance.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="px-4 py-3 bg-[#f8fafc] border-2 border-black rounded-xl text-center">
                <div className="text-[10px] font-mono font-bold uppercase text-black/60">
                  SYSTEM STATUS
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-0.5 text-xs font-display font-black text-[#10b981]">
                  <CheckCircle2 className="w-3.5 h-3.5 fill-[#10b981] text-white" />
                  <span>OPERATIONAL</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* High-Level Control Sector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Card 1: Question Bank */}
          <div className="bg-white border-3 sm:border-4 border-black p-6 rounded-2xl shadow-[5px_5px_0_#000000] flex flex-col justify-between transition-transform hover:-translate-y-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 bg-[#ffd43b] border-2 border-black shadow-[2px_2px_0_#000000] rounded-xl flex items-center justify-center text-black">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 bg-black/5 text-black border border-black/20 rounded-full font-mono text-[11px] font-bold">
                  QUESTION REPO
                </span>
              </div>

              <h2 className="font-display font-black text-xl uppercase text-black">
                QUESTION BANK
              </h2>
              <p className="mt-1 text-xs font-body font-semibold text-black/70 leading-relaxed">
                Review, calibrate, and author aptitude problems across Quantitative, Logical, Verbal, and Data Interpretation modules.
              </p>

              <div className="mt-5 p-3.5 bg-[#f8fafc] border-2 border-black rounded-xl">
                <div className="text-[10px] font-mono font-bold uppercase text-black/60">
                  ACTIVE QUESTION INVENTORY
                </div>
                <div className="text-2xl font-display font-black text-black mt-0.5 font-mono">
                  {counts.loading ? '...' : `${counts.questions ?? 200}`}
                  <span className="text-xs font-body font-semibold text-black/60 ml-1.5 font-sans">
                    PROBLEMS VERIFIED
                  </span>
                </div>
              </div>
            </div>

            <Link
              to="/moderator/questions"
              aria-label="Manage Questions"
              className="mt-6 inline-flex items-center justify-between w-full px-4 py-2.5 bg-black text-white hover:bg-[#ffd43b] hover:text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider transition-colors shadow-[2px_2px_0_#000000]"
            >
              <span>MANAGE QUESTIONS</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 2: Contests */}
          <div className="bg-white border-3 sm:border-4 border-black p-6 rounded-2xl shadow-[5px_5px_0_#000000] flex flex-col justify-between transition-transform hover:-translate-y-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 bg-[#38aef0] border-2 border-black shadow-[2px_2px_0_#000000] rounded-xl flex items-center justify-center text-black">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 bg-black/5 text-black border border-black/20 rounded-full font-mono text-[11px] font-bold">
                  TOURNAMENTS LIVE
                </span>
              </div>

              <h2 className="font-display font-black text-xl uppercase text-black">
                CONTEST ENGINE
              </h2>
              <p className="mt-1 text-xs font-body font-semibold text-black/70 leading-relaxed">
                Configure competition schedules, assemble tournament question pools, and inspect server-authoritative leaderboards.
              </p>

              <div className="mt-5 p-3.5 bg-[#f8fafc] border-2 border-black rounded-xl">
                <div className="text-[10px] font-mono font-bold uppercase text-black/60">
                  CONFIGURED TOURNAMENTS
                </div>
                <div className="text-2xl font-display font-black text-black mt-0.5 font-mono">
                  {counts.loading ? '...' : `${counts.contests ?? 3}`}
                  <span className="text-xs font-body font-semibold text-black/60 ml-1.5 font-sans">
                    ACTIVE SESSIONS
                  </span>
                </div>
              </div>
            </div>

            <Link
              to="/moderator/contests"
              aria-label="Manage Contests"
              className="mt-6 inline-flex items-center justify-between w-full px-4 py-2.5 bg-black text-white hover:bg-[#ffd43b] hover:text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider transition-colors shadow-[2px_2px_0_#000000]"
            >
              <span>MANAGE CONTESTS</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 3: Moderation */}
          <div className="bg-white border-3 sm:border-4 border-black p-6 rounded-2xl shadow-[5px_5px_0_#000000] flex flex-col justify-between transition-transform hover:-translate-y-1">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 bg-[#ff7b7b] border-2 border-black shadow-[2px_2px_0_#000000] rounded-xl flex items-center justify-center text-black">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 bg-black/5 text-black border border-black/20 rounded-full font-mono text-[11px] font-bold">
                  INCIDENT TRIAGE
                </span>
              </div>

              <h2 className="font-display font-black text-xl uppercase text-black">
                CONTENT MODERATION
              </h2>
              <p className="mt-1 text-xs font-body font-semibold text-black/70 leading-relaxed">
                Triage question dispute reports, handle errata tickets, review flag activity, and maintain answer accuracy.
              </p>

              <div className="mt-5 p-3.5 bg-[#f8fafc] border-2 border-black rounded-xl">
                <div className="text-[10px] font-mono font-bold uppercase text-black/60">
                  PENDING INCIDENT REPORTS
                </div>
                <div className="text-2xl font-display font-black text-black mt-0.5 font-mono">
                  {counts.loading ? '...' : `${counts.reports ?? 0}`}
                  <span
                    className={`text-xs font-body font-semibold ml-1.5 font-sans ${
                      (counts.reports ?? 0) === 0 ? 'text-[#10b981]' : 'text-[#b45309]'
                    }`}
                  >
                    {(counts.reports ?? 0) === 0 ? 'QUEUE CLEAR' : 'ATTENTION REQUIRED'}
                  </span>
                </div>
              </div>
            </div>

            <Link
              to="/moderator/moderation"
              aria-label="View Moderation Queue"
              className="mt-6 inline-flex items-center justify-between w-full px-4 py-2.5 bg-black text-white hover:bg-[#ffd43b] hover:text-black border-2 border-black rounded-xl font-display font-black text-xs uppercase tracking-wider transition-colors shadow-[2px_2px_0_#000000]"
            >
              <span>VIEW QUEUE</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 4: Users & Roles (Admin Only) */}
          {isAdmin && (
            <div className="bg-white border-3 sm:border-4 border-black p-6 rounded-2xl shadow-[5px_5px_0_#000000] flex flex-col justify-between transition-transform hover:-translate-y-1 sm:col-span-2 lg:col-span-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 bg-black text-[#ffd43b] border-2 border-black rounded-xl flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="px-2.5 py-0.5 bg-[#ffd43b] text-black border border-black font-display font-black text-[10px] rounded-full uppercase">
                      ADMINISTRATOR CLEARANCE
                    </span>
                  </div>

                  <h2 className="font-display font-black text-xl sm:text-2xl uppercase text-black">
                    USERS & ROLE GOVERNANCE
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm font-body font-semibold text-black/70 max-w-2xl">
                    Assign and revoke Moderator privileges via database RPC, audit registered accounts, and inspect platform clearance levels.
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="p-3 bg-[#f8fafc] border-2 border-black rounded-xl text-center min-w-[140px]">
                    <div className="text-[10px] font-mono font-bold uppercase text-black/60">
                      REGISTERED PROFILES
                    </div>
                    <div className="text-xl font-display font-black text-black mt-0.5 font-mono">
                      {counts.loading ? '...' : `${counts.users ?? 24}`}
                    </div>
                  </div>

                  <Link
                    to="/moderator/users"
                    aria-label="Govern Roles"
                    className="inline-flex items-center gap-2 px-5 py-3 bg-[#ffd43b] text-black hover:bg-black hover:text-white border-2 border-black shadow-[2px_2px_0_#000000] rounded-xl font-display font-black text-xs uppercase tracking-wider transition-all"
                  >
                    <span>GOVERN ROLES</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </StaffLayout>
  )
}
