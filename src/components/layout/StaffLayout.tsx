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
  { id: 'overview', label: 'Overview', path: '/moderator', icon: LayoutDashboard },
  { id: 'questions', label: 'Questions', path: '/moderator/questions', icon: BookOpen },
  { id: 'contests', label: 'Contests', path: '/moderator/contests', icon: Trophy },
  { id: 'moderation', label: 'Moderation', path: '/moderator/moderation', icon: AlertCircle },
  { id: 'users', label: 'Users & Roles', path: '/moderator/users', icon: Users, adminOnly: true },
]

export default function StaffLayout({ children }: StaffLayoutProps) {
  const location = useLocation()
  const { role, isAdmin } = useRole()

  // Filter navigation items: Admin gets all, Moderator gets all except adminOnly
  const visibleNavItems = STAFF_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="min-h-screen bg-[#071a2b] text-[#050505] flex flex-col relative arena-bg-grid">
      {/* Staff Control Center Header */}
      <header className="sticky top-0 z-40 bg-[#071a2b]/95 backdrop-blur-md border-b border-white/10 px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Control Center Title */}
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="flex items-center gap-2 group shrink-0" aria-label="Apticks Dashboard">
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-[#ffd43b] border border-[#0c1d2d]/20 shadow-xs rounded-xl flex items-center justify-center transition-colors">
                <span className="font-display font-black text-sm text-[#0c1d2d]">A</span>
              </div>
            </Link>

            <div className="border-l border-white/15 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-base sm:text-lg tracking-tight text-white leading-none">
                  Control Center
                </span>
                <span
                  className={`
                    inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider rounded-full border
                    ${isAdmin ? 'bg-[#ffd43b]/20 text-[#ffd43b] border-[#ffd43b]/40' : 'bg-[#38aef0]/20 text-[#38aef0] border-[#38aef0]/40'}
                  `}
                >
                  <Shield className="w-2.5 h-2.5 fill-current" />
                  {role.toUpperCase()}
                </span>
              </div>
              <p className="hidden sm:block text-[11px] font-body text-white/50 mt-0.5">
                Manage content, competitions and platform governance.
              </p>
            </div>
          </div>

          {/* Action: Return to Arena */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 hover:bg-white/15 text-white border border-white/15 rounded-xl font-display font-bold text-xs uppercase tracking-wider transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Arena</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Staff Navigation Tabs */}
      <div className="bg-[#0b243b] border-b border-white/10 px-4 sm:px-6 lg:px-8 py-2 sticky top-[49px] sm:top-[53px] z-30">
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
                  inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs font-bold shrink-0 transition-colors select-none
                  ${
                    isActive
                      ? 'bg-[#ffd43b] text-[#0c1d2d] shadow-xs'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
                <span>{item.label}</span>
                {item.adminOnly && (
                  <span className="ml-1 text-[9px] px-1 py-0.2 bg-[#0c1d2d] text-white rounded font-mono">
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
