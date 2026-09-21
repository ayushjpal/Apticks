import React from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

export interface AuthAlertProps {
  type?: 'error' | 'success' | 'info'
  message: string
  className?: string
}

export const AuthAlert: React.FC<AuthAlertProps> = ({
  type = 'error',
  message,
  className = '',
}) => {
  if (!message) return null

  if (type === 'success') {
    return (
      <div
        role="status"
        className={`p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs font-sans font-medium flex items-start gap-2.5 ${className}`}
      >
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
        <span className="leading-relaxed">{message}</span>
      </div>
    )
  }

  if (type === 'info') {
    return (
      <div
        role="status"
        className={`p-3 bg-sky-950/40 border border-sky-800/60 rounded-xl text-sky-300 text-xs font-sans font-medium flex items-start gap-2.5 ${className}`}
      >
        <Info className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
        <span className="leading-relaxed">{message}</span>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className={`p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs font-sans font-medium flex items-start gap-2.5 ${className}`}
    >
      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
      <span className="leading-relaxed">{message}</span>
    </div>
  )
}

export default AuthAlert
