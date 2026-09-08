import React from 'react'

export interface NeoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: 'white' | 'yellow' | 'blue' | 'green' | 'red' | 'purple' | 'navy' | 'paper'
  size?: 'sm' | 'md' | 'lg'
  shadowColor?: 'black' | 'yellow' | 'blue' | 'none'
  hoverEffect?: boolean
  className?: string
}

export const NeoCard: React.FC<NeoCardProps> = ({
  children,
  variant = 'white',
  size = 'md',
  shadowColor = 'black',
  hoverEffect = false,
  className = '',
  ...props
}) => {
  const variantStyles = {
    white: 'bg-white text-[#050505] border-[#0c1d2d]/12',
    paper: 'bg-[#f8fafc] text-[#050505] border-[#0c1d2d]/10',
    yellow: 'bg-amber-50 text-amber-950 border-amber-200',
    blue: 'bg-sky-50 text-sky-950 border-sky-200',
    green: 'bg-emerald-50 text-emerald-950 border-emerald-200',
    red: 'bg-rose-50 text-rose-950 border-rose-200',
    purple: 'bg-purple-50 text-purple-950 border-purple-200',
    navy: 'bg-[#0c1d2d] text-white border-white/10',
  }

  const radiusStyles = {
    sm: 'rounded-lg border p-3 sm:p-4',
    md: 'rounded-xl border p-4 sm:p-5',
    lg: 'rounded-xl border p-5 sm:p-6',
  }

  const shadowStyles = {
    black: 'shadow-xs',
    yellow: 'shadow-xs',
    blue: 'shadow-xs',
    none: 'shadow-none',
  }

  const hoverClass = hoverEffect
    ? 'transition-all duration-150 hover:shadow-sm cursor-pointer'
    : ''

  return (
    <div
      className={`
        ${variantStyles[variant]}
        ${radiusStyles[size]}
        ${shadowStyles[shadowColor]}
        ${hoverClass}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
}

export default NeoCard
