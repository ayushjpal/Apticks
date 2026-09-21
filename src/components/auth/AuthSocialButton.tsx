import React from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'

export interface AuthSocialButtonProps {
  provider: 'google' | 'github'
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  label?: string
  compact?: boolean
  className?: string
}

export const AuthSocialButton: React.FC<AuthSocialButtonProps> = ({
  provider,
  onClick,
  loading = false,
  disabled = false,
  label,
  compact = false,
  className = '',
}) => {
  const isGoogle = provider === 'google'
  const defaultLabel = compact
    ? isGoogle
      ? 'Google'
      : 'GitHub'
    : isGoogle
    ? 'Continue with Google'
    : 'Continue with GitHub'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        w-full ${compact ? 'py-2.5 px-3 justify-center' : 'py-3 px-4 justify-between'}
        bg-[#071a2b]/80 hover:bg-[#0c1d2d] border border-slate-700/80 hover:border-slate-600
        rounded-xl font-sans font-medium text-xs text-slate-200 hover:text-white transition-all
        flex items-center shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer
        ${className}
      `}
    >
      <div className={`flex items-center gap-2.5 ${compact ? 'justify-center' : ''}`}>
        {isGoogle ? (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M21.35 12.27c0-.71-.06-1.4-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.44h3.14c1.84-1.69 2.91-4.18 2.91-7.21z"
            />
            <path
              fill="#34A853"
              d="M12 21.82c2.63 0 4.84-.87 6.45-2.35l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.55 0-4.72-1.72-5.5-4.04H3.25v2.52A9.74 9.74 0 0 0 12 21.82z"
            />
            <path
              fill="#FBBC05"
              d="M6.5 13.91A5.86 5.86 0 0 1 6.2 12c0-.66.11-1.3.3-1.91V7.57H3.25A9.82 9.82 0 0 0 2.18 12c0 1.59.38 3.09 1.07 4.43L6.5 13.91z"
            />
            <path
              fill="#EA4335"
              d="M12 6.05c1.43 0 2.72.49 3.74 1.46l2.8-2.8C16.84 3.15 14.63 2.18 12 2.18a9.74 9.74 0 0 0-8.75 5.39L6.5 10.09C7.28 7.77 9.45 6.05 12 6.05z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 shrink-0 text-white fill-current"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.25c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.8 1.3 3.48.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.76.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5z" />
          </svg>
        )}
        <span>{loading ? 'Connecting...' : label || defaultLabel}</span>
      </div>

      {!compact &&
        (loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
        ) : (
          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
        ))}
    </button>
  )
}

export default AuthSocialButton
