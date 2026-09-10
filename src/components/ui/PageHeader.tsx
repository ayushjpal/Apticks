import React from 'react'

export interface PageHeaderProps {
  title: React.ReactNode
  eyebrow?: string
  eyebrowIcon?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  badge?: React.ReactNode
  compact?: boolean
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  eyebrow,
  eyebrowIcon,
  description,
  actions,
  badge,
  compact = false,
  className = '',
}) => {
  return (
    <section
      className={`
        bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl text-white
        flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4
        ${compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5 lg:p-6'}
        ${className}
      `}
    >
      <div className="max-w-2xl min-w-0">
        {(eyebrow || eyebrowIcon) && (
          <div className="inline-flex items-center gap-1.5 text-slate-400 text-[11px] font-mono font-bold tracking-wider uppercase mb-1">
            {eyebrowIcon && <span className="shrink-0 text-amber-400">{eyebrowIcon}</span>}
            {eyebrow && <span>{eyebrow}</span>}
          </div>
        )}

        <div className="flex items-center gap-2.5 flex-wrap">
          <h1
            className={`
              font-display font-black tracking-tight text-white leading-tight
              ${compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'}
            `}
          >
            {title}
          </h1>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>

        {description && (
          <p className="mt-1 text-xs sm:text-sm font-body text-slate-400 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </section>
  )
}

export default PageHeader
