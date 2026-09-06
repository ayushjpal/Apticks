import React from 'react'
import { AlertTriangle, type LucideIcon } from 'lucide-react'

/* =========================================================================
   1. STAFF PAGE HEADER
   Unified top header banner for staff screens
   ========================================================================= */
export interface StaffPageHeaderProps {
  badgeText?: string
  badgeIcon?: React.ReactNode
  badgeVariant?: 'yellow' | 'blue' | 'navy' | 'neutral'
  title: string
  description?: string
  actions?: React.ReactNode
}

export function StaffPageHeader({
  badgeText,
  badgeIcon,
  badgeVariant = 'navy',
  title,
  description,
  actions,
}: StaffPageHeaderProps) {
  const badgeStyles = {
    yellow: 'bg-[#ffd43b] text-black border-black',
    blue: 'bg-[#38aef0] text-black border-black',
    navy: 'bg-[#071a2b] text-white border-black',
    neutral: 'bg-black/5 text-black border-black/20',
  }

  return (
    <div className="bg-white border-3 sm:border-4 border-black p-5 sm:p-7 rounded-2xl shadow-[6px_6px_0_#000000] relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          {badgeText && (
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-display font-black uppercase tracking-wider border-2 ${badgeStyles[badgeVariant]}`}
            >
              {badgeIcon}
              <span>{badgeText}</span>
            </div>
          )}
          <h1 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl uppercase text-black tracking-tight leading-none">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm font-body font-semibold text-black/70 max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 flex-wrap">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================================================
   2. STAFF METRIC CARD
   Standardized metric tile across Control Center screens
   ========================================================================= */
export interface StaffMetricCardProps {
  label: string
  value: React.ReactNode
  subtext?: string
  icon?: React.ReactNode
  iconBg?: string
  valueColor?: string
  loading?: boolean
}

export function StaffMetricCard({
  label,
  value,
  subtext,
  icon,
  iconBg = 'bg-[#ffd43b]',
  valueColor = 'text-black',
  loading = false,
}: StaffMetricCardProps) {
  return (
    <div className="bg-white border-3 border-black p-4 sm:p-5 rounded-2xl shadow-[4px_4px_0_#000000] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-black/60">
          {label}
        </span>
        {icon && (
          <div
            className={`w-8 h-8 rounded-lg border-2 border-black flex items-center justify-center text-black shrink-0 ${iconBg} shadow-[1.5px_1.5px_0_#000000]`}
          >
            {icon}
          </div>
        )}
      </div>

      <div>
        <div className={`text-2xl sm:text-3xl font-display font-black tracking-tight ${valueColor}`}>
          {loading ? '...' : value}
        </div>
        {subtext && (
          <div className="text-[11px] font-body font-semibold text-black/50 mt-1 truncate">
            {subtext}
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================================================
   3. STAFF STATUS BADGE
   Unified status pills for questions, contests, and user roles
   ========================================================================= */
export interface StaffStatusBadgeProps {
  status: string
  className?: string
}

export function StaffStatusBadge({ status, className = '' }: StaffStatusBadgeProps) {
  const norm = status.toLowerCase()
  let style = 'bg-black/5 text-black border-black/20'

  if (norm === 'live' || norm === 'active') {
    style = 'bg-[#32e875] text-black border-black shadow-[1.5px_1.5px_0_#000000]'
  } else if (norm === 'upcoming') {
    style = 'bg-[#38aef0] text-black border-black shadow-[1.5px_1.5px_0_#000000]'
  } else if (norm === 'draft') {
    style = 'bg-[#ffd43b] text-black border-black shadow-[1.5px_1.5px_0_#000000]'
  } else if (norm === 'completed') {
    style = 'bg-black/10 text-black/80 border-black/30'
  } else if (norm === 'cancelled' || norm === 'inactive') {
    style = 'bg-[#fee2e2] text-[#b91c1c] border-[#b91c1c]/30'
  } else if (norm === 'admin') {
    style = 'bg-[#ffd43b] text-black border-black shadow-[1.5px_1.5px_0_#000000]'
  } else if (norm === 'moderator') {
    style = 'bg-[#38aef0] text-black border-black shadow-[1.5px_1.5px_0_#000000]'
  } else if (norm === 'user') {
    style = 'bg-black/5 text-black/80 border-black/20'
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[10px] font-mono font-bold uppercase tracking-wider select-none ${style} ${className}`}
    >
      {status}
    </span>
  )
}

/* =========================================================================
   4. STAFF EMPTY STATE
   Standardized empty feedback box
   ========================================================================= */
export interface StaffEmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export function StaffEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: StaffEmptyStateProps) {
  return (
    <div className="p-8 sm:p-12 text-center border-2 sm:border-3 border-dashed border-black/25 rounded-2xl bg-[#f8fafc]/80 space-y-3">
      <div className="w-12 h-12 rounded-xl bg-black/5 border-2 border-black/20 mx-auto flex items-center justify-center text-black/40">
        <Icon className="w-6 h-6 stroke-[2]" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display font-black text-sm sm:text-base uppercase text-black tracking-tight">
          {title}
        </h3>
        <p className="text-xs font-body font-semibold text-black/60 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

/* =========================================================================
   5. STAFF ERROR BANNER
   Standardized error feedback box
   ========================================================================= */
export interface StaffErrorBannerProps {
  message: string
  onRetry?: () => void
}

export function StaffErrorBanner({ message, onRetry }: StaffErrorBannerProps) {
  return (
    <div className="bg-[#fee2e2] border-2 sm:border-3 border-black p-4 rounded-xl shadow-[3px_3px_0_#000000] flex items-center justify-between gap-3 text-black">
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-5 h-5 text-[#b91c1c] shrink-0" />
        <span className="text-xs font-body font-bold text-black truncate">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1 bg-white text-black hover:bg-black hover:text-white border-2 border-black rounded-lg text-xs font-display font-black uppercase transition-colors shrink-0 shadow-[1.5px_1.5px_0_#000000]"
        >
          RETRY
        </button>
      )}
    </div>
  )
}
