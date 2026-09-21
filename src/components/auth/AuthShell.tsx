import React from 'react'
import AuthBackground from './AuthBackground'
import AuthBrand from './AuthBrand'

export interface AuthShellProps {
  eyebrow?: string
  title: string
  subtitle: string
  children: React.ReactNode
  showBrandFeatures?: boolean
}

export const AuthShell: React.FC<AuthShellProps> = ({
  eyebrow = 'APTICKS ACCOUNT',
  title,
  subtitle,
  children,
}) => {
  return (
    <AuthBackground variant="default">
      <main className="w-full max-w-lg mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center">
        {/* Unified Brand Header */}
        <div className="mb-6 flex justify-center">
          <AuthBrand />
        </div>

        {/* Auth Panel Card */}
        <div className="w-full bg-[#0c1d2d] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          {/* Eyebrow badge */}
          {eyebrow && (
            <div className="inline-flex items-center gap-1.5 bg-slate-800/60 text-slate-300 border border-slate-700/80 rounded-md px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffd43b]" />
              <span>{eyebrow}</span>
            </div>
          )}

          {/* Title & Subtitle */}
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight leading-tight mb-2">
            {title}
          </h1>
          <p className="font-sans text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
            {subtitle}
          </p>

          {/* Form Children */}
          {children}
        </div>
      </main>
    </AuthBackground>
  )
}

export default AuthShell
