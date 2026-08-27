import React from 'react'
import { Loader2 } from 'lucide-react'

export interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  fullWidth?: boolean
}

export const NeoButton: React.FC<NeoButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles = {
    primary:
      'bg-[#ffd43b] hover:bg-[#facc15] text-[#050505] border-2 sm:border-3 border-black shadow-[3px_3px_0_#000000] hover:shadow-[4px_4px_0_#000000] active:shadow-[1px_1px_0_#000000]',
    secondary:
      'bg-white hover:bg-[#f8fafc] text-[#050505] border-2 sm:border-3 border-black shadow-[3px_3px_0_#000000] hover:shadow-[4px_4px_0_#000000] active:shadow-[1px_1px_0_#000000]',
    accent:
      'bg-[#38aef0] hover:bg-[#209be2] text-[#050505] border-2 sm:border-3 border-black shadow-[3px_3px_0_#000000] hover:shadow-[4px_4px_0_#000000] active:shadow-[1px_1px_0_#000000]',
    success:
      'bg-[#32e875] hover:bg-[#22c55e] text-[#050505] border-2 sm:border-3 border-black shadow-[3px_3px_0_#000000] hover:shadow-[4px_4px_0_#000000] active:shadow-[1px_1px_0_#000000]',
    danger:
      'bg-[#ff5b5b] hover:bg-[#ef4444] text-white border-2 sm:border-3 border-black shadow-[3px_3px_0_#000000] hover:shadow-[4px_4px_0_#000000] active:shadow-[1px_1px_0_#000000]',
    ghost:
      'bg-transparent hover:bg-black/5 text-[#050505] border-2 border-transparent hover:border-black/20',
  }

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs font-black rounded-lg gap-1.5',
    md: 'px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-black rounded-xl gap-2',
    lg: 'px-6 sm:px-7 py-3.5 sm:py-4 text-sm sm:text-base font-black rounded-xl gap-2.5',
  }

  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-display uppercase tracking-wider
        cursor-pointer transition-all duration-120 select-none
        hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[3px_3px_0_#000000]
        ${fullWidth ? 'w-full' : 'w-auto'}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span className="truncate">{children}</span>
      {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  )
}

export default NeoButton
