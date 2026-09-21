import React from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'

export interface AuthPrimaryButtonProps {
  type?: 'submit' | 'button'
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export const AuthPrimaryButton: React.FC<AuthPrimaryButtonProps> = ({
  type = 'submit',
  onClick,
  disabled = false,
  loading = false,
  loadingText,
  icon = <ArrowRight className="w-4 h-4" />,
  children,
  className = '',
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        w-full py-3.5 px-5 bg-[#ffd43b] hover:bg-[#facc15] active:scale-[0.99]
        text-[#071a2b] font-display font-bold text-sm tracking-wider uppercase rounded-xl
        border border-[#ffd43b] shadow-sm transition-all flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer select-none
        ${className}
      `}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-[#071a2b]" />
          <span>{loadingText || 'Please wait...'}</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          {icon}
        </>
      )}
    </button>
  )
}

export default AuthPrimaryButton
