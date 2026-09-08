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
    yellow: 'bg-amber-50 text-amber-900 border-amber-200',
    blue: 'bg-sky-50 text-sky-800 border-sky-200',
    navy: 'bg-[#0c1d2d] text-white border-[#0c1d2d]',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  }

  return (
    <div className="bg-white border border-[#0c1d2d]/12 p-5 sm:p-6 rounded-2xl shadow-xs relative overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          {badgeText && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${badgeStyles[badgeVariant]}`}
            >
              {badgeIcon}
              <span>{badgeText}</span>
            </div>
          )}
          <h1 className="font-display font-bold text-xl sm:text-2xl lg:text-3xl text-[#0c1d2d] tracking-tight leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-xs sm:text-sm font-body text-slate-600 max-w-2xl leading-relaxed">
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
  iconBg = 'bg-amber-50 border-amber-200 text-amber-700',
  valueColor = 'text-[#0c1d2d]',
  loading = false,
}: StaffMetricCardProps) {
  return (
    <div className="bg-white border border-[#0c1d2d]/12 p-4 sm:p-5 rounded-xl shadow-xs flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        {icon && (
          <div
            className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}
          >
            {icon}
          </div>
        )}
      </div>

      <div>
        <div className={`text-2xl font-display font-bold tracking-tight ${valueColor}`}>
          {loading ? '...' : value}
        </div>
        {subtext && (
          <div className="text-[11px] font-body text-slate-500 mt-0.5 truncate">
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
  let style = 'bg-slate-100 text-slate-700 border-slate-200'

  if (norm === 'live' || norm === 'active') {
    style = 'bg-emerald-50 text-emerald-800 border-emerald-200'
  } else if (norm === 'upcoming') {
    style = 'bg-sky-50 text-sky-800 border-sky-200'
  } else if (norm === 'draft') {
    style = 'bg-amber-50 text-amber-800 border-amber-200'
  } else if (norm === 'completed') {
    style = 'bg-slate-100 text-slate-800 border-slate-300'
  } else if (norm === 'cancelled' || norm === 'inactive') {
    style = 'bg-rose-50 text-rose-800 border-rose-200'
  } else if (norm === 'admin') {
    style = 'bg-amber-50 text-amber-900 border-amber-300'
  } else if (norm === 'moderator') {
    style = 'bg-sky-50 text-sky-800 border-sky-200'
  } else if (norm === 'user') {
    style = 'bg-slate-100 text-slate-700 border-slate-200'
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold uppercase tracking-wider select-none ${style} ${className}`}
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
    <div className="p-8 sm:p-12 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50/70 space-y-3">
      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-400 shadow-xs">
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display font-bold text-sm sm:text-base text-[#0c1d2d] tracking-tight">
          {title}
        </h3>
        <p className="text-xs font-body text-slate-500 max-w-sm mx-auto leading-relaxed">
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
    <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-xs flex items-center justify-between gap-3 text-rose-900">
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
        <span className="text-xs font-body font-medium truncate">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-display font-bold uppercase transition-colors shrink-0 shadow-xs cursor-pointer"
        >
          Retry
        </button>
      )}
    </div>
  )
}
