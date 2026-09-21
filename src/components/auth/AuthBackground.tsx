import React from 'react'
import AuthBrand from './AuthBrand'

export interface AuthBackgroundProps {
  variant?: 'login' | 'signup' | 'forgot' | 'update' | 'default'
  children?: React.ReactNode
  navRight?: React.ReactNode
  editorialBottomLeft?: React.ReactNode
  editorialBottomRight?: React.ReactNode
}

export const AuthBackground: React.FC<AuthBackgroundProps> = ({
  variant = 'default',
  children,
  navRight,
  editorialBottomLeft,
  editorialBottomRight,
}) => {
  return (
    <div className="min-h-screen bg-[#071a2b] text-slate-100 flex flex-col justify-between relative overflow-x-hidden arena-bg-grid selection:bg-[#ffd43b]/20 selection:text-[#ffd43b]">
      {/* ========================================================= */}
      {/* SUBTLE AMBIENT WARMTH & GEOMETRY                          */}
      {/* ========================================================= */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      >
        {/* Faint ambient warmth in upper corner */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-400/[0.025] rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-500/[0.02] rounded-full blur-3xl" />

        {/* --- 1. LOGIN GEOMETRY: Geometric "A" construction + yellow speed streak --- */}
        {variant === 'login' && (
          <>
            {/* Faint large angular A outline in background */}
            <svg
              className="absolute right-[-2%] top-1/2 -translate-y-1/2 w-[620px] h-[620px] opacity-[0.035] text-white"
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            >
              <polygon points="18,80 28,80 45,35 35,35" />
              <polygon points="44,20 54,20 74,80 64,80 51,42 44,20" />
              <line x1="10" y1="62" x2="70" y2="35" stroke="#ffd43b" strokeWidth="1.2" opacity="0.4" />
            </svg>

            {/* Thin yellow diagonal speed line crossing the background */}
            <div
              className="absolute -left-20 top-1/3 w-[140%] h-[1px] bg-gradient-to-r from-transparent via-[#ffd43b]/20 to-transparent rotate-[-15deg]"
            />
          </>
        )}

        {/* --- 2. SIGNUP GEOMETRY: Progressive horizon lines + small star element --- */}
        {variant === 'signup' && (
          <>
            <svg
              className="absolute left-[-5%] bottom-0 w-[700px] h-[400px] opacity-[0.03] text-white"
              viewBox="0 0 700 400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <line x1="0" y1="350" x2="700" y2="350" />
              <line x1="0" y1="320" x2="700" y2="320" />
              <line x1="0" y1="280" x2="700" y2="280" />
              <line x1="0" y1="230" x2="700" y2="230" />
              <line x1="150" y1="400" x2="350" y2="150" stroke="#ffd43b" opacity="0.3" />
            </svg>
            <div className="absolute right-12 top-24 opacity-20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#ffd43b">
                <path d="M12 0 L14 9 L23 12 L14 15 L12 24 L10 15 L1 12 L10 9 Z" />
              </svg>
            </div>
          </>
        )}

        {/* --- 3. FORGOT GEOMETRY: Restrained concentric circular rings --- */}
        {variant === 'forgot' && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] flex items-center justify-center opacity-[0.035]">
            <div className="w-[600px] h-[600px] rounded-full border border-white" />
            <div className="absolute w-[420px] h-[420px] rounded-full border border-sky-400" />
            <div className="absolute w-[240px] h-[240px] rounded-full border border-[#ffd43b]" />
          </div>
        )}

        {/* --- 4. UPDATE GEOMETRY: Subtle faceted shield motif lines --- */}
        {variant === 'update' && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 w-[500px] h-[500px] flex items-center justify-center opacity-[0.035]">
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1" className="w-full h-full text-white">
              <polygon points="50,15 85,30 85,65 50,85 15,65 15,30" />
              <polygon points="50,25 75,36 75,60 50,75 25,60 25,36" stroke="#ffd43b" opacity="0.4" />
            </svg>
          </div>
        )}
      </div>

      {/* Top Header: Apticks Logo (Left) + Contextual Navigation (Right) */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 pt-6 sm:pt-8 flex items-center justify-between">
        <AuthBrand />
        {navRight && (
          <div className="font-mono text-xs text-slate-400 flex items-center">
            {navRight}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-6 sm:py-10 flex-1 flex flex-col justify-center">
        {children}
      </main>

      {/* Footer: Editorial or College Project notes */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-6 flex items-end justify-between">
        {editorialBottomLeft ? (
          <div className="font-mono text-[10px] sm:text-[11px] tracking-[0.2em] text-slate-500 uppercase leading-relaxed select-none">
            {editorialBottomLeft}
          </div>
        ) : (
          <span className="font-mono text-xs text-slate-500">It&apos;s a college project.</span>
        )}

        {editorialBottomRight ? (
          <div className="font-mono text-[10px] sm:text-[11px] tracking-[0.2em] text-slate-500 uppercase leading-relaxed text-right select-none">
            {editorialBottomRight}
          </div>
        ) : (
          <span className="font-mono text-[11px] text-slate-600">APTICKS // SPEED ARENA</span>
        )}
      </footer>
    </div>
  )
}

export default AuthBackground
