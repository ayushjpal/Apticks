import React from 'react'

export interface NeoBadgeProps {
  children: React.ReactNode
  variant?: 'yellow' | 'blue' | 'green' | 'red' | 'purple' | 'neutral' | 'dark'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
  className?: string
}

export const NeoBadge: React.FC<NeoBadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  icon,
  className = '',
}) => {
  const variantStyles = {
    yellow: 'bg-[#ffd43b] text-[#050505] border-black shadow-[1.5px_1.5px_0_#000000]',
    blue: 'bg-[#38aef0] text-[#050505] border-black shadow-[1.5px_1.5px_0_#000000]',
    green: 'bg-[#32e875] text-[#050505] border-black shadow-[1.5px_1.5px_0_#000000]',
    red: 'bg-[#ff5b5b] text-white border-black shadow-[1.5px_1.5px_0_#000000]',
    purple: 'bg-[#c084fc] text-[#050505] border-black shadow-[1.5px_1.5px_0_#000000]',
    neutral: 'bg-[#f1f5f9] text-[#050505] border-black/80 shadow-[1.5px_1.5px_0_#000000]',
    dark: 'bg-[#071a2b] text-white border-black shadow-[1.5px_1.5px_0_#ffd43b]',
  }

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-[10px] gap-1',
    md: 'px-3 py-1 text-xs gap-1.5',
  }

  return (
    <span
      className={`
        inline-flex items-center font-display font-black uppercase tracking-wider
        rounded-full border-2 select-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  )
}

export default NeoBadge
