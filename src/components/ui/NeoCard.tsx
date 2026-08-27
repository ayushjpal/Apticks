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
    white: 'bg-white text-[#050505] border-black',
    paper: 'bg-[#faf9f6] text-[#050505] border-black',
    yellow: 'bg-[#ffd43b] text-[#050505] border-black',
    blue: 'bg-[#38aef0] text-[#050505] border-black',
    green: 'bg-[#32e875] text-[#050505] border-black',
    red: 'bg-[#ff5b5b] text-white border-black',
    purple: 'bg-[#c084fc] text-[#050505] border-black',
    navy: 'bg-[#071a2b] text-white border-black',
  }

  const radiusStyles = {
    sm: 'rounded-lg border-2 p-3 sm:p-4',
    md: 'rounded-xl border-2 sm:border-3 p-4 sm:p-6',
    lg: 'rounded-2xl border-3 sm:border-4 p-6 sm:p-8',
  }

  const shadowStyles = {
    black: size === 'lg' ? 'shadow-[6px_6px_0_#000000]' : size === 'sm' ? 'shadow-[2.5px_2.5px_0_#000000]' : 'shadow-[4px_4px_0_#000000]',
    yellow: size === 'lg' ? 'shadow-[6px_6px_0_#ffd43b]' : 'shadow-[4px_4px_0_#ffd43b]',
    blue: size === 'lg' ? 'shadow-[6px_6px_0_#38aef0]' : 'shadow-[4px_4px_0_#38aef0]',
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
