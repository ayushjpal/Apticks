import React from 'react'
import { Loader2 } from 'lucide-react'

export interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'success' | 'dark'
  size?: 'xs' | 'sm' | 'md' | 'lg'
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
      'bg-[#ffd43b] hover:bg-[#facb15] text-[#0c1d2d] border border-amber-400/80 shadow-[0_0_15px_rgba(255,212,59,0.2)] hover:shadow-[0_0_20px_rgba(255,212,59,0.35)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all',
    secondary:
      'bg-white/10 hover:bg-white/15 text-white border border-white/15 shadow-xs hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all',
    dark:
      'bg-[#0c1d2d] hover:bg-[#162a3d] text-white border border-[#0c1d2d] shadow-xs active:translate-y-[1px]',
    accent:
      'bg-[#38aef0] hover:bg-[#209be2] text-white border border-[#38aef0] shadow-xs active:translate-y-[1px]',
    success:
      'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 shadow-xs active:translate-y-[1px]',
    danger:
      'bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 shadow-xs active:translate-y-[1px]',
    ghost:
      'bg-transparent hover:bg-slate-100 text-[#0c1d2d] border border-transparent shadow-none',
  }

  const sizeStyles = {
    xs: 'px-2 py-1 text-[11px] font-semibold rounded-md gap-1',
    sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg gap-1.5',
    md: 'px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg gap-2',
    lg: 'px-5 py-2.5 text-sm sm:text-base font-semibold rounded-lg gap-2.5',
  }

  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-medium
        cursor-pointer transition-all duration-120 select-none
        disabled:opacity-50 disabled:cursor-not-allowed
        ${fullWidth ? 'w-full' : 'w-auto'}
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span className="truncate">{children}</span>
      {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  )
}

export default NeoButton
