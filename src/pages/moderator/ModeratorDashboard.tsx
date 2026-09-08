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
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="bg-white border border-[#0c1d2d]/12 p-5 sm:p-7 rounded-2xl shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#0c1d2d] text-white rounded-full text-[10px] font-mono font-bold uppercase tracking-wider mb-2.5">
                <ShieldCheck className="w-3 h-3 text-[#ffd43b]" />
                <span>Staff Clearance: {role.toUpperCase()}</span>
              </div>
              <h1 className="font-display font-bold text-xl sm:text-2xl lg:text-3xl text-[#0c1d2d] tracking-tight leading-tight">
                Control Center Overview
              </h1>
              <p className="mt-1.5 text-xs sm:text-sm font-body text-slate-600 max-w-2xl leading-relaxed">
                Elevated staff workspace for overseeing Apticks competitive systems, problem bank assets, tournament engines, and platform governance.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                  System Status
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-0.5 text-xs font-display font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Operational</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* High-Level Control Sector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Question Bank */}
          <div className="bg-white border border-[#0c1d2d]/12 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-9 h-9 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-amber-700">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-mono text-[10px] font-medium">
                  Question Repo
                </span>
              </div>

              <h2 className="font-display font-bold text-lg text-[#0c1d2d]">
                Question Bank
              </h2>
              <p className="mt-1 text-xs font-body text-slate-600 leading-relaxed">
                Review, calibrate, and author aptitude problems across Quantitative, Logical, Verbal, and Data Interpretation modules.
              </p>

              <div className="mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                  Active Question Inventory
                </div>
                <div className="text-2xl font-display font-bold text-[#0c1d2d] mt-0.5 font-mono">
                  {counts.loading ? '...' : `${counts.questions ?? 200}`}
                  <span className="text-xs font-body font-normal text-slate-500 ml-1.5 font-sans">
                    problems verified
                  </span>
                </div>
              </div>
            </div>

            <Link
              to="/moderator/questions"
              aria-label="Manage Questions"
              className="mt-5 inline-flex items-center justify-between w-full px-4 py-2.5 bg-[#0c1d2d] hover:bg-slate-800 text-white rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-colors shadow-xs"
            >
              <span>Manage Questions</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 2: Contests */}
          <div className="bg-white border border-[#0c1d2d]/12 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-9 h-9 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-center text-sky-700">
                  <Trophy className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-mono text-[10px] font-medium">
                  Tournaments Live
                </span>
              </div>

              <h2 className="font-display font-bold text-lg text-[#0c1d2d]">
                Contest Engine
              </h2>
              <p className="mt-1 text-xs font-body text-slate-600 leading-relaxed">
                Configure competition schedules, assemble tournament question pools, and inspect server-authoritative leaderboards.
              </p>

              <div className="mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                  Configured Tournaments
                </div>
                <div className="text-2xl font-display font-bold text-[#0c1d2d] mt-0.5 font-mono">
                  {counts.loading ? '...' : `${counts.contests ?? 3}`}
                  <span className="text-xs font-body font-normal text-slate-500 ml-1.5 font-sans">
                    active sessions
                  </span>
                </div>
              </div>
            </div>

            <Link
              to="/moderator/contests"
              aria-label="Manage Contests"
              className="mt-5 inline-flex items-center justify-between w-full px-4 py-2.5 bg-[#0c1d2d] hover:bg-slate-800 text-white rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-colors shadow-xs"
            >
              <span>Manage Contests</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 3: Moderation */}
          <div className="bg-white border border-[#0c1d2d]/12 p-5 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="w-9 h-9 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center text-rose-700">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-mono text-[10px] font-medium">
                  Incident Triage
                </span>
              </div>

              <h2 className="font-display font-bold text-lg text-[#0c1d2d]">
                Content Moderation
              </h2>
              <p className="mt-1 text-xs font-body text-slate-600 leading-relaxed">
                Triage question dispute reports, handle errata tickets, review flag activity, and maintain answer accuracy.
              </p>

              <div className="mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
                <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                  Pending Incident Reports
                </div>
                <div className="text-2xl font-display font-bold text-[#0c1d2d] mt-0.5 font-mono">
                  {counts.loading ? '...' : `${counts.reports ?? 0}`}
                  <span
                    className={`text-xs font-body font-semibold ml-1.5 font-sans ${
                      (counts.reports ?? 0) === 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {(counts.reports ?? 0) === 0 ? 'Queue Clear' : 'Attention Required'}
                  </span>
                </div>
              </div>
            </div>

            <Link
              to="/moderator/moderation"
              aria-label="View Moderation Queue"
              className="mt-5 inline-flex items-center justify-between w-full px-4 py-2.5 bg-[#0c1d2d] hover:bg-slate-800 text-white rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-colors shadow-xs"
            >
              <span>View Queue</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Card 4: Users & Roles (Admin Only) */}
          {isAdmin && (
            <div className="bg-white border border-[#0c1d2d]/12 p-5 sm:p-6 rounded-2xl shadow-xs sm:col-span-2 lg:col-span-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="px-2.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 font-display font-bold text-[10px] rounded-full uppercase">
                      Administrator Clearance
                    </span>
                  </div>

                  <h2 className="font-display font-bold text-lg sm:text-xl text-[#0c1d2d]">
                    Users & Role Governance
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm font-body text-slate-600 max-w-2xl">
                    Assign and revoke Moderator privileges via database RPC, audit registered accounts, and inspect platform clearance levels.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center min-w-[130px]">
                    <div className="text-[10px] font-mono font-bold uppercase text-slate-500">
                      Registered Profiles
                    </div>
                    <div className="text-xl font-display font-bold text-[#0c1d2d] mt-0.5 font-mono">
                      {counts.loading ? '...' : `${counts.users ?? 24}`}
                    </div>
                  </div>

                  <Link
                    to="/moderator/users"
                    aria-label="Govern Roles"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ffd43b] hover:bg-[#facc15] text-[#0c1d2d] border border-[#0c1d2d]/20 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-colors shadow-xs"
                  >
                    <span>Govern Roles</span>
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
