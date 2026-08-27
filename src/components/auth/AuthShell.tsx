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
    <div className="min-h-screen bg-[#071a2b] flex items-center justify-center p-3.5 sm:p-5 lg:p-8 relative overflow-hidden arena-bg-grid">
      {/* Background Decorative Layer: strictly pointer-events-none and non-overflowing */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
        <div
          aria-hidden="true"
          className="absolute top-6 left-6 w-7 h-7 bg-[#ffd43b]/40 border-2 border-black/50 rounded-lg shadow-[2px_2px_0_rgba(0,0,0,0.3)] -rotate-12 hidden lg:flex items-center justify-center font-display font-black text-xs text-black/60"
        >
          +
        </div>
        <div
          aria-hidden="true"
          className="absolute bottom-8 right-8 w-6 h-6 bg-[#38aef0]/40 border-2 border-black/50 rounded-lg shadow-[2px_2px_0_rgba(0,0,0,0.3)] rotate-12 hidden lg:flex items-center justify-center font-display font-black text-xs text-black/60"
        >
          7
        </div>
      </div>

      {/* Main Split-Screen Container Card */}
      <main className="w-full max-w-4xl bg-white border-3 sm:border-4 border-black rounded-2xl sm:rounded-3xl shadow-[6px_6px_0_#000000] lg:shadow-[10px_10px_0_#38aef0] grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] overflow-hidden z-10">
        {/* ================================================= */}
        {/* LEFT BRAND PANEL                                  */}
        {/* ================================================= */}
        <section className="bg-[#071a2b] text-white p-5 sm:p-7 lg:p-8 flex flex-col justify-between border-b-3 lg:border-b-0 lg:border-r-3 border-black relative overflow-hidden">
          {/* Subtle grid in brand panel */}
          <div className="absolute inset-0 arena-bg-grid opacity-20 pointer-events-none" />

          {/* Top Logo & Tagline */}
          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-10 h-10 bg-[#ffd43b] border-2 sm:border-3 border-black rounded-xl shadow-[2.5px_2.5px_0_#000000] flex items-center justify-center font-display font-black text-2xl text-black transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
                A
              </div>
              <div>
                <span className="font-display font-black text-xl tracking-tight text-white block leading-none">
                  APTICKS
                </span>
                <span className="font-mono text-[8px] font-bold tracking-[0.2em] text-[#38aef0] uppercase">
                  SPEED ARENA
                </span>
              </div>
            </Link>

            {/* Editorial Headline */}
            <div className="mt-6 sm:mt-8">
              <div className="inline-block bg-[#38aef0] text-black border-2 border-black rounded-full px-2.5 py-0.5 text-[9px] font-display font-black tracking-widest uppercase mb-3 shadow-[1.5px_1.5px_0_#000000]">
                THE COMPETITIVE ARENA
              </div>
              <h1 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl uppercase tracking-tighter leading-[0.9] text-white">
                THINK.
                <br />
                SOLVE.
                <br />
                <span className="text-[#ffd43b]">BEAT THE</span>
                <br />
                <span className="text-[#38aef0]">CLOCK.</span>
              </h1>

              <p className="mt-3.5 text-xs sm:text-sm font-body font-medium text-white/80 leading-relaxed max-w-xs">
                Sharpen your aptitude. Compete in real-time battles. Keep your streak alive and climb the leaderboard.
              </p>
            </div>
          </div>

          {/* Bottom Feature Cards */}
          {showBrandFeatures && (
            <div className="relative z-10 mt-6 pt-4 border-t-2 border-white/20 grid grid-cols-3 gap-2">
              <div className="bg-[#ffd43b] text-black border-2 border-black rounded-lg p-2 shadow-[1.5px_1.5px_0_#000000]">
                <div className="flex items-center justify-between text-[9px] font-mono font-black mb-0.5">
                  <span>01</span>
                  <Zap className="w-3 h-3 fill-black" />
                </div>
                <div className="font-display font-black text-[10px] leading-tight uppercase">
                  LIVE ARENA
                </div>
              </div>

              <div className="bg-[#38aef0] text-black border-2 border-black rounded-lg p-2 shadow-[1.5px_1.5px_0_#000000]">
                <div className="flex items-center justify-between text-[9px] font-mono font-black mb-0.5">
                  <span>02</span>
                  <Trophy className="w-3 h-3" />
                </div>
                <div className="font-display font-black text-[10px] leading-tight uppercase">
                  RANKINGS
                </div>
              </div>

              <div className="bg-[#32e875] text-black border-2 border-black rounded-lg p-2 shadow-[1.5px_1.5px_0_#000000]">
                <div className="flex items-center justify-between text-[9px] font-mono font-black mb-0.5">
                  <span>03</span>
                  <ShieldCheck className="w-3 h-3" />
                </div>
                <div className="font-display font-black text-[10px] leading-tight uppercase">
                  ANALYSIS
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ================================================= */}
        {/* RIGHT FORM PANEL                                  */}
        {/* ================================================= */}
        <section className="p-5 sm:p-7 lg:p-8 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-1.5 bg-[#f1f5f9] text-black border-2 border-black rounded-full px-2.5 py-0.5 text-[9px] font-mono font-black tracking-widest uppercase mb-2.5 shadow-[1px_1px_0_#000000]">
              <Sparkles className="w-2.5 h-2.5 text-[#ffd43b] fill-[#ffd43b]" />
              <span>{eyebrow}</span>
            </div>

            {/* Title & Subtitle */}
            <h2 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight text-black leading-tight">
              {title}
            </h2>
            <p className="mt-1 mb-4 text-xs sm:text-sm font-body font-semibold text-black/70 leading-relaxed">
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
