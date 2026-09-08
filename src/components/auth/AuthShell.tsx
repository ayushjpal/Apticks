import React from 'react'
import { Link } from 'react-router-dom'
import { Zap, ShieldCheck, Trophy, Sparkles } from 'lucide-react'
import ApticksLogo from '../ui/ApticksLogo'

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
  showBrandFeatures = true,
}) => {
  return (
    <div className="min-h-screen bg-[#071a2b] flex items-center justify-center p-3.5 sm:p-5 lg:p-8 relative overflow-hidden arena-bg-grid">
      {/* Main Split-Screen Container Card */}
      <main className="w-full max-w-4xl bg-white border border-slate-200/80 rounded-2xl sm:rounded-3xl shadow-2xl grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] overflow-hidden z-10">
        {/* ================================================= */}
        {/* LEFT BRAND PANEL                                  */}
        {/* ================================================= */}
        <section className="bg-[#0c1d2d] text-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative overflow-hidden">
          {/* Subtle grid in brand panel */}
          <div className="absolute inset-0 arena-bg-grid opacity-15 pointer-events-none" />

          {/* Top Logo & Tagline */}
          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-2.5 group" aria-label="Apticks Home">
              <div className="w-9 h-9 bg-[#ffd43b] rounded-xl shadow-xs flex items-center justify-center p-1 transition-transform group-hover:scale-105">
                <ApticksLogo variant="mark" className="w-full h-full" ariaHidden />
              </div>
              <div>
                <span className="font-display font-bold text-lg tracking-tight text-white block leading-none">
                  Apticks
                </span>
                <span className="font-mono text-[9px] font-semibold tracking-wider text-sky-400 uppercase">
                  Speed Arena
                </span>
              </div>
            </Link>

            {/* Editorial Headline */}
            <div className="mt-8 sm:mt-10">
              <div className="inline-block bg-sky-500/15 text-sky-400 border border-sky-500/30 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase mb-3">
                The Competitive Arena
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white">
                Think. Solve.
                <br />
                <span className="text-[#ffd43b]">Beat The Clock.</span>
              </h1>

              <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xs">
                Sharpen your aptitude. Compete in real-time speed battles. Keep your streak alive and climb the global ranks.
              </p>
            </div>
          </div>

          {/* Bottom Feature Cards */}
          {showBrandFeatures && (
            <div className="relative z-10 mt-8 pt-5 border-t border-white/10 grid grid-cols-3 gap-2.5">
              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#ffd43b] mb-1">
                  <span>01</span>
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-semibold text-white tracking-wide">
                  Live Arena
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-sky-400 mb-1">
                  <span>02</span>
                  <Trophy className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-semibold text-white tracking-wide">
                  Rankings
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-emerald-400 mb-1">
                  <span>03</span>
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-semibold text-white tracking-wide">
                  Analysis
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ================================================= */}
        {/* RIGHT FORM PANEL                                  */}
        {/* ================================================= */}
        <section className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase mb-2.5">
              <Sparkles className="w-2.5 h-2.5 text-[#f59e0b] fill-[#f59e0b]" />
              <span>{eyebrow}</span>
            </div>

            {/* Title & Subtitle */}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
              {title}
            </h2>
            <p className="mt-1 mb-5 text-xs sm:text-sm text-slate-500 leading-relaxed">
              {subtitle}
            </p>

            {/* Form Content */}
            {children}
          </div>
        </section>
      </main>
    </div>
  )
}

export default AuthShell
