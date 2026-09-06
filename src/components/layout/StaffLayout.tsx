import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Shield,
  LayoutDashboard,
  BookOpen,
  Trophy,
  AlertCircle,
  Users,
  ArrowLeft,
} from 'lucide-react'
import { useRole } from '../../hooks/useRole'

interface StaffLayoutProps {
  children: React.ReactNode
}

interface StaffNavItem {
  id: string
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const STAFF_NAV_ITEMS: StaffNavItem[] = [
  { id: 'overview', label: 'OVERVIEW', path: '/moderator', icon: LayoutDashboard },
  { id: 'questions', label: 'QUESTIONS', path: '/moderator/questions', icon: BookOpen },
  { id: 'contests', label: 'CONTESTS', path: '/moderator/contests', icon: Trophy },
  { id: 'moderation', label: 'MODERATION', path: '/moderator/moderation', icon: AlertCircle },
  { id: 'users', label: 'USERS & ROLES', path: '/moderator/users', icon: Users, adminOnly: true },
]

export default function StaffLayout({ children }: StaffLayoutProps) {
  const location = useLocation()
  const { role, isAdmin } = useRole()

  // Filter navigation items: Admin gets all, Moderator gets all except adminOnly
  const visibleNavItems = STAFF_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="min-h-screen bg-[#071a2b] text-[#050505] flex flex-col relative arena-bg-grid">
      {/* Staff Control Center Header */}
      <header className="sticky top-0 z-40 bg-[#071a2b]/95 backdrop-blur-md border-b-3 border-black px-4 py-3 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Control Center Title */}
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2.5 group shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#ffd43b] border-2 sm:border-3 border-black shadow-[2.5px_2.5px_0_#000000] rounded-xl flex items-center justify-center font-display font-black text-xl text-black transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
                A
              </div>
            </Link>

            <div className="border-l-2 border-white/20 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-base sm:text-lg tracking-tight text-white leading-none">
                  CONTROL CENTER
                </span>
                <span
                  className={`
                    inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-display font-black uppercase tracking-wider rounded-full border-2 border-black shadow-[1.5px_1.5px_0_#000000]
                    ${isAdmin ? 'bg-[#ffd43b] text-black' : 'bg-[#38aef0] text-black'}
                  `}
                >
                  <Shield className="w-2.5 h-2.5 fill-current" />
                  {role.toUpperCase()}
                </span>
              </div>
              <p className="hidden sm:block text-[11px] font-body font-semibold text-white/60 mt-0.5">
                Manage Apticks content, competitions and platform governance.
              </p>
            </div>
          </div>

          {/* Action: Return to Arena */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-black border-2 border-black shadow-[2px_2px_0_#000000] rounded-xl font-display font-black text-xs uppercase tracking-wider hover:bg-[#ffd43b] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">RETURN TO ARENA</span>
              <span className="sm:hidden">ARENA</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Staff Navigation Tabs */}
      <div className="bg-[#0b243b] border-b-3 border-black px-4 sm:px-6 lg:px-8 py-2 sticky top-[57px] sm:top-[65px] z-30 shadow-[0_4px_0_rgba(0,0,0,0.2)]">
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          {visibleNavItems.map((item) => {
            const isActive =
              item.path === '/moderator'
                ? location.pathname === '/moderator'
                : location.pathname.startsWith(item.path)
            const Icon = item.icon

            return (
              <Link
                key={item.id}
                to={item.path}
                className={`
                  inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border-2 border-black font-display font-black text-xs uppercase tracking-wider shrink-0 transition-all select-none
                  ${
                    isActive
                      ? 'bg-[#ffd43b] text-black shadow-[2.5px_2.5px_0_#000000] -translate-y-0.5'
                      : 'bg-white/10 text-white/80 border-transparent hover:bg-white/20 hover:text-white hover:border-black/50'
                  }
                `}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                <span>{item.label}</span>
                {item.adminOnly && (
                  <span className="ml-1 text-[9px] px-1 py-0.2 bg-black text-white rounded font-mono">
                    ADMIN
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
