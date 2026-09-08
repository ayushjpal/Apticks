import React from 'react'
import {
  CheckCircle2,
  Clock,
  Flame,
  Bookmark,
  Radio,
  Archive,
  AlertTriangle,
} from 'lucide-react'

export type StatusType =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'open'
  | 'master'
  | 'live'
  | 'upcoming'
  | 'completed'
  | 'draft'
  | 'cancelled'
  | 'solved'
  | 'attempted'
  | 'unsolved'
  | 'bookmarked'
  | 'online'
  | 'division-1'
  | 'at-risk'
  | 'active'

export interface StatusBadgeProps {
  status: StatusType
  label?: string
  size?: 'xs' | 'sm' | 'md'
  density?: 'xs' | 'sm' | 'md'
  showIcon?: boolean
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  density,
  showIcon = true,
  className = '',
}) => {
  const effectiveSize = density || size
  const configs: Record<
    StatusType,
    {
      defaultLabel: string
      style: string
      icon?: React.ReactNode
    }
  > = {
    // Difficulties
    easy: {
      defaultLabel: 'Easy',
      style: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    },
    medium: {
      defaultLabel: 'Medium',
      style: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    },
    hard: {
      defaultLabel: 'Hard',
      style: 'bg-rose-50 text-rose-700 border border-rose-200/80',
    },
    open: {
      defaultLabel: 'Open',
      style: 'bg-sky-50 text-sky-700 border border-sky-200/80',
    },
    master: {
      defaultLabel: 'Master',
      style: 'bg-purple-50 text-purple-700 border border-purple-200/80',
    },

    // Contest States
    live: {
      defaultLabel: 'LIVE NOW',
      style: 'bg-rose-600 text-white border border-rose-600',
      icon: <Radio className="w-3 h-3 animate-pulse" />,
    },
    upcoming: {
      defaultLabel: 'Upcoming',
      style: 'bg-sky-50 text-sky-700 border border-sky-200/80',
      icon: <Clock className="w-3 h-3" />,
    },
    completed: {
      defaultLabel: 'Archived',
      style: 'bg-slate-100 text-slate-600 border border-slate-200',
      icon: <Archive className="w-3 h-3" />,
    },
    draft: {
      defaultLabel: 'Draft',
      style: 'bg-slate-100 text-slate-500 border border-slate-200',
    },
    cancelled: {
      defaultLabel: 'Cancelled',
      style: 'bg-rose-50 text-rose-600 border border-rose-200',
    },

    // Progress States
    solved: {
      defaultLabel: 'Solved',
      style: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    attempted: {
      defaultLabel: 'Attempted',
      style: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    },
    unsolved: {
      defaultLabel: 'Unsolved',
      style: 'bg-slate-50 text-slate-500 border border-slate-200',
    },
    bookmarked: {
      defaultLabel: 'Saved',
      style: 'bg-amber-50 text-amber-800 border border-amber-200/80',
      icon: <Bookmark className="w-3 h-3 fill-current" />,
    },

    // User States
    online: {
      defaultLabel: 'Online',
      style: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      icon: <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />,
    },
    'division-1': {
      defaultLabel: 'Division 1',
      style: 'bg-sky-50 text-sky-700 border border-sky-200',
    },
    'at-risk': {
      defaultLabel: 'At Risk',
      style: 'bg-rose-50 text-rose-700 border border-rose-200',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    active: {
      defaultLabel: 'Active',
      style: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      icon: <Flame className="w-3 h-3 fill-current" />,
    },
  }

  const config = configs[status]
  const text = label || config.defaultLabel

  const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-[9px] sm:text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-[10px] sm:text-[11px] gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  }

  return (
    <span
      className={`
        inline-flex items-center font-mono font-semibold tracking-tight
        rounded-full select-none
        ${config.style}
        ${sizeStyles[effectiveSize]}
        ${className}
      `}
    >
      {showIcon && config.icon && <span className="shrink-0">{config.icon}</span>}
      <span className="truncate">{text}</span>
    </span>
  )
}

export default StatusBadge
