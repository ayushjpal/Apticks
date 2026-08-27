import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Trophy, BookOpen, BarChart2, User } from 'lucide-react'

interface NavTab {
  id: string
  label: string
  path: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_TABS: NavTab[] = [
  { id: 'home', label: 'HOME', path: '/dashboard', icon: Home },
  { id: 'contests', label: 'CONTESTS', path: '/contests', icon: Trophy },
  { id: 'practice', label: 'PRACTICE', path: '/questions', icon: BookOpen },
  { id: 'rank', label: 'RANK', path: '/leaderboard', icon: BarChart2 },
  { id: 'profile', label: 'PROFILE', path: '/profile', icon: User },
]

export default function BottomNavbar() {
  const location = useLocation()
  const navigate = useNavigate()

  const getIsActive = (path: string) => {
    if (path === '/dashboard' && location.pathname === '/dashboard') return true
    if (path === '/questions' && location.pathname.startsWith('/questions')) return true
    if (path === '/contests' && location.pathname.startsWith('/contests')) return true
    if (path === '/leaderboard' && location.pathname.startsWith('/leaderboard')) return true
    if (path === '/profile' && location.pathname.startsWith('/profile')) return true
    return false
  }

  return (
    <nav
      aria-label="Arena Navigation"
      className="fixed bottom-3 sm:bottom-5 inset-x-0 z-50 px-3 sm:px-4 pointer-events-none flex justify-center"
    >
      <div className="w-full max-w-xl bg-white/95 backdrop-blur-md border-3 border-black shadow-[6px_6px_0_#000000] rounded-2xl sm:rounded-full px-2 py-1.5 pointer-events-auto flex items-center justify-between gap-1">
        {NAV_TABS.map((tab) => {
          const isActive = getIsActive(tab.path)
          const IconComponent = tab.icon

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigate(tab.path)}
              aria-current={isActive ? 'page' : undefined}
              className={`
                flex-1 min-w-0 py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-xl sm:rounded-full
                flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2
                font-display font-black text-[10px] sm:text-xs uppercase tracking-wider
                transition-all duration-120 cursor-pointer select-none
                ${
                  isActive
                    ? 'bg-[#ffd43b] text-black border-2 border-black shadow-[2px_2px_0_#000000] -translate-y-0.5'
                    : 'text-black/70 hover:text-black hover:bg-black/5 active:scale-95'
                }
              `}
            >
              <IconComponent className={`w-4 h-4 shrink-0 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="truncate leading-none">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
