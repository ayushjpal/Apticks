import React from 'react'
import { Link } from 'react-router-dom'
import { Zap, ShieldCheck, Trophy, Sparkles } from 'lucide-react'

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
    <div className="min-h-screen bg-[#071a2b] flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden arena-bg-grid">
      {/* Decorative Neo-Brutalist Floating Accents */}
      <div
        aria-hidden="true"
        className="absolute top-8 left-8 w-12 h-12 bg-[#ffd43b] border-3 border-black rounded-2xl shadow-[4px_4px_0_#38aef0] -rotate-12 hidden sm:flex items-center justify-center font-display font-black text-2xl select-none pointer-events-none"
      >
        +
      </div>
      <div
        aria-hidden="true"
        className="absolute top-12 right-12 w-10 h-10 bg-[#38aef0] border-3 border-black rounded-xl shadow-[4px_4px_0_#ffffff] rotate-12 hidden sm:flex items-center justify-center font-display font-black text-lg select-none pointer-events-none"
      >
        7
      </div>
      <div
        aria-hidden="true"
        className="absolute bottom-10 left-12 w-11 h-11 bg-[#32e875] border-3 border-black rounded-xl shadow-[4px_4px_0_#ffffff] -rotate-6 hidden sm:flex items-center justify-center font-display font-black text-xl select-none pointer-events-none"
      >
        =
      </div>
      <div
        aria-hidden="true"
        className="absolute bottom-12 right-16 w-11 h-11 bg-[#ff5b5b] text-white border-3 border-black rounded-2xl shadow-[4px_4px_0_#ffffff] rotate-12 hidden sm:flex items-center justify-center font-display font-black text-xl select-none pointer-events-none"
      >
        ×
      </div>

      {/* Main Split-Screen Container Card */}
      <main className="w-full max-w-5xl bg-white border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[8px_8px_0_#000000] lg:shadow-[12px_12px_0_#38aef0] grid grid-cols-1 lg:grid-cols-[1.1fr_1.3fr] overflow-hidden z-10">
        {/* ================================================= */}
        {/* LEFT BRAND PANEL                                  */}
        {/* ================================================= */}
        <section className="bg-[#071a2b] text-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between border-b-3 lg:border-b-0 lg:border-r-3 border-black relative overflow-hidden">
          {/* Subtle grid in brand panel */}
          <div className="absolute inset-0 arena-bg-grid opacity-20 pointer-events-none" />

          {/* Top Logo & Tagline */}
          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-3 group">
              <div className="w-12 h-12 bg-[#ffd43b] border-3 border-black rounded-2xl shadow-[3px_3px_0_#000000] flex items-center justify-center font-display font-black text-3xl text-black transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
                A
              </div>
              <div>
                <span className="font-display font-black text-2xl tracking-tight text-white block leading-none">
                  APTICKS
                </span>
                <span className="font-mono text-[9px] font-bold tracking-[0.2em] text-[#38aef0] uppercase">
                  APTITUDE • SPEED • COMPETITION
                </span>
              </div>
            </Link>

            {/* Editorial Headline */}
            <div className="mt-8 sm:mt-12">
              <div className="inline-block bg-[#38aef0] text-black border-2 border-black rounded-full px-3 py-1 text-[10px] font-display font-black tracking-widest uppercase mb-4 shadow-[2px_2px_0_#000000]">
                THE COMPETITIVE ARENA
              </div>
              <h1 className="font-display font-black text-4xl sm:text-5xl lg:text-6xl uppercase tracking-tighter leading-[0.9] text-white">
                THINK.
                <br />
                SOLVE.
                <br />
                <span className="text-[#ffd43b]">BEAT THE</span>
                <br />
                <span className="text-[#38aef0]">CLOCK.</span>
              </h1>

              <p className="mt-5 text-sm sm:text-base font-body font-medium text-white/80 leading-relaxed max-w-sm">
                Sharpen your aptitude. Compete in real-time battles. Keep your streak alive and climb the leaderboard.
              </p>
            </div>
          </div>

          {/* Bottom Feature Cards */}
          {showBrandFeatures && (
            <div className="relative z-10 mt-8 pt-6 border-t-2 border-white/20 grid grid-cols-3 gap-2">
              <div className="bg-[#ffd43b] text-black border-2 border-black rounded-xl p-2.5 shadow-[2px_2px_0_#000000]">
                <div className="flex items-center justify-between text-[10px] font-mono font-black mb-1">
                  <span>01</span>
                  <Zap className="w-3.5 h-3.5 fill-black" />
                </div>
                <div className="font-display font-black text-[11px] leading-tight uppercase">
                  LIVE ARENA
                </div>
              </div>

              <div className="bg-[#38aef0] text-black border-2 border-black rounded-xl p-2.5 shadow-[2px_2px_0_#000000]">
                <div className="flex items-center justify-between text-[10px] font-mono font-black mb-1">
                  <span>02</span>
                  <Trophy className="w-3.5 h-3.5" />
                </div>
                <div className="font-display font-black text-[11px] leading-tight uppercase">
                  RANKINGS
                </div>
              </div>

              <div className="bg-[#32e875] text-black border-2 border-black rounded-xl p-2.5 shadow-[2px_2px_0_#000000]">
                <div className="flex items-center justify-between text-[10px] font-mono font-black mb-1">
                  <span>03</span>
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="font-display font-black text-[11px] leading-tight uppercase">
                  ANALYSIS
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
            <div className="inline-flex items-center gap-1.5 bg-[#f1f5f9] text-black border-2 border-black rounded-full px-3 py-0.5 text-[10px] font-mono font-black tracking-widest uppercase mb-3 shadow-[1.5px_1.5px_0_#000000]">
              <Sparkles className="w-3 h-3 text-[#ffd43b] fill-[#ffd43b]" />
              <span>{eyebrow}</span>
            </div>

            {/* Title & Subtitle */}
            <h2 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tight text-black leading-tight">
              {title}
            </h2>
            <p className="mt-1.5 mb-6 text-xs sm:text-sm font-body font-semibold text-black/70 leading-relaxed">
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
