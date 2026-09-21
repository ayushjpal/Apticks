import React from 'react'

export interface AuthInputProps {
  id: string
  label?: string
  labelRight?: React.ReactNode
  type?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  icon?: React.ReactNode
  prefixText?: string
  autoFocus?: boolean
  autoComplete?: string
  maxLength?: number
  disabled?: boolean
  required?: boolean
  action?: React.ReactNode
  helperText?: React.ReactNode
  error?: string
  className?: string
}

export const AuthInput: React.FC<AuthInputProps> = ({
  id,
  label,
  labelRight,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon,
  prefixText,
  autoFocus = false,
  autoComplete,
  maxLength,
  disabled = false,
  required = false,
  action,
  helperText,
  error,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      {(label || labelRight) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <label
              htmlFor={id}
              className="block text-xs font-mono font-semibold uppercase tracking-wider text-slate-300"
            >
              {label}
            </label>
          )}
          {labelRight && <div>{labelRight}</div>}
        </div>
      )}

      <div
        className={`
          flex items-center bg-[#071a2b]/90 border rounded-xl shadow-xs overflow-hidden transition-all
          ${
            error
              ? 'border-rose-500/80 focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500/40'
              : 'border-slate-700/80 hover:border-slate-600 focus-within:border-[#ffd43b] focus-within:ring-1 focus-within:ring-[#ffd43b]/40'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-900/40' : ''}
        `}
      >
        {(icon || prefixText) && (
          <span className="px-3.5 py-3 border-r border-slate-700/80 bg-slate-800/40 text-slate-400 font-mono text-xs flex items-center shrink-0 select-none">
            {icon && <span className="mr-1.5">{icon}</span>}
            {prefixText && <span>{prefixText}</span>}
          </span>
        )}

        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          maxLength={maxLength}
          disabled={disabled}
          required={required}
          className="w-full py-3 px-3.5 outline-none font-sans font-medium text-sm bg-transparent placeholder:text-slate-500 text-white selection:bg-[#ffd43b]/30"
        />

        {action && <div className="px-3 shrink-0 flex items-center">{action}</div>}
      </div>

      {error ? (
        <p className="mt-1.5 text-xs text-rose-400 font-sans">{error}</p>
      ) : helperText ? (
        <div className="mt-1.5 text-[11px] text-slate-400 font-mono">{helperText}</div>
      ) : null}
    </div>
  )
}

export default AuthInput
