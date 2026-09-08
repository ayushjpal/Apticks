import React from 'react'

export interface NeoBadgeProps {
  children: React.ReactNode
  variant?: 'yellow' | 'blue' | 'green' | 'red' | 'purple' | 'neutral' | 'dark' | 'outline'
  size?: 'xs' | 'sm' | 'md'
  density?: 'xs' | 'sm' | 'md'
  icon?: React.ReactNode
  className?: string
}

export const NeoBadge: React.FC<NeoBadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  density,
  icon,
  className = '',
}) => {
  const effectiveSize = density || size
  const variantStyles = {
    yellow: 'bg-amber-50 text-amber-900 border border-amber-200',
    blue: 'bg-sky-50 text-sky-800 border border-sky-200',
    green: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    red: 'bg-rose-50 text-rose-800 border border-rose-200',
    purple: 'bg-purple-50 text-purple-800 border border-purple-200',
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
    dark: 'bg-[#0c1d2d] text-white border border-[#0c1d2d]',
    outline: 'bg-transparent text-slate-700 border border-slate-200',
  }

  const sizeStyles = {
    xs: 'px-1.5 py-0.5 text-[9px] sm:text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-[10px] sm:text-[11px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  }

  return (
    <span
      className={`
        inline-flex items-center font-mono font-medium
        rounded-md select-none
        ${variantStyles[variant]}
        ${sizeStyles[effectiveSize]}
        ${className}
      `}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  )
}

export default NeoBadge
