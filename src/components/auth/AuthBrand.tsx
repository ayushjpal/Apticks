import React from 'react'
import { Link } from 'react-router-dom'
import { ApticksLogo } from '../ui/ApticksLogo'

export interface AuthBrandProps {
  className?: string
  subtitle?: string
}

export const AuthBrand: React.FC<AuthBrandProps> = ({
  className = '',
  subtitle,
}) => {
  return (
    <div className={`flex flex-col items-start ${className}`}>
      <Link
        to="/"
        className="inline-flex items-center gap-3 group transition-transform hover:scale-[1.01]"
        aria-label="Apticks Speed Arena - Home"
      >
        <ApticksLogo variant="full" theme="dark" />
      </Link>
      {subtitle && (
        <span className="font-mono text-[11px] text-slate-400 mt-1.5 uppercase tracking-wider">
          {subtitle}
        </span>
      )}
    </div>
  )
}

export default AuthBrand
