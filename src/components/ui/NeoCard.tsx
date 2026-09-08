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
    white: 'bg-white text-[#050505] border-[#0c1d2d]',
    paper: 'bg-[#faf9f6] text-[#050505] border-[#0c1d2d]',
    yellow: 'bg-[#ffd43b] text-[#050505] border-[#0c1d2d]',
    blue: 'bg-[#38aef0] text-[#050505] border-[#0c1d2d]',
    green: 'bg-[#32e875] text-[#050505] border-[#0c1d2d]',
    red: 'bg-[#ff5b5b] text-white border-[#0c1d2d]',
    purple: 'bg-[#c084fc] text-[#050505] border-[#0c1d2d]',
    navy: 'bg-[#071a2b] text-white border-[#0c1d2d]',
  }

  const radiusStyles = {
    sm: 'rounded-lg border-[1.5px] p-3 sm:p-4',
    md: 'rounded-xl border-2 p-4 sm:p-6',
    lg: 'rounded-2xl border-2 p-6 sm:p-8',
  }

  const shadowStyles = {
    black: size === 'lg' ? 'shadow-[4px_4px_0_#0c1d2d]' : size === 'sm' ? 'shadow-[2px_2px_0_#0c1d2d]' : 'shadow-[3px_3px_0_#0c1d2d]',
    yellow: size === 'lg' ? 'shadow-[4px_4px_0_#ffd43b]' : 'shadow-[3px_3px_0_#ffd43b]',
    blue: size === 'lg' ? 'shadow-[4px_4px_0_#38aef0]' : 'shadow-[3px_3px_0_#38aef0]',
    none: 'shadow-none',
  }

  const hoverClass = hoverEffect
    ? 'transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer'
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
