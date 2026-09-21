import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ApticksLogo } from '../components/ui/ApticksLogo'
import FlexCardShowcase from '../components/overview/FlexCardShowcase'

export default function Overview() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  // Check auth session to route CTAs if user is already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session?.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <main className="min-h-screen bg-[#071a2b] text-slate-100 flex flex-col justify-between relative overflow-x-hidden arena-bg-grid selection:bg-[#ffd43b]/20 selection:text-[#ffd43b]">
      {/* Restrained, subtle ambient light behind hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-10 w-[500px] h-[500px] bg-amber-400/[0.02] rounded-full blur-3xl"
      />

      {/* Main Content Arena */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 lg:pt-16 pb-12 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* ======================================================= */}
          {/* LEFT: HERO CONTENT                                      */}
          {/* ======================================================= */}
          <div className="lg:col-span-5 flex flex-col text-left">
            {/* New Apticks Brand Mark Lockup */}
            <div className="mb-6 sm:mb-8">
              <ApticksLogo variant="full" theme="dark" />
            </div>

            {/* Hero Headline */}
            <h1 className="font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.08] mb-5">
              Think First.
              <br />
              <span className="text-[#ffd43b]">Solve.</span>
            </h1>

            {/* Supporting Copy */}
            <p className="font-sans text-base sm:text-lg text-slate-300 leading-relaxed max-w-md mb-8 sm:mb-9">
              A competitive aptitude arena built for practice, speed, and consistency.
            </p>

            {/* Primary & Secondary Call to Actions */}
            <div className="flex flex-wrap items-center gap-3.5">
              <Link
                to={isAuthenticated ? '/dashboard' : '/signup'}
                className="px-6 py-3.5 bg-[#ffd43b] hover:bg-[#facc15] text-[#071a2b] font-display font-bold text-sm tracking-wider uppercase rounded-lg border border-[#ffd43b] shadow-xs transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center gap-2"
              >
                <span>{isAuthenticated ? 'ENTER ARENA' : 'START COMPETING'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to={isAuthenticated ? '/dashboard' : '/login'}
                className="px-6 py-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 text-slate-200 hover:text-white font-display font-semibold text-sm tracking-wider uppercase rounded-lg transition-all active:scale-[0.99]"
              >
                <span>{isAuthenticated ? 'DASHBOARD' : 'SIGN IN'}</span>
              </Link>
            </div>
          </div>

          {/* ======================================================= */}
          {/* RIGHT: FLEX CARD SHOWCASE                               */}
          {/* ======================================================= */}
          <div className="lg:col-span-7 w-full flex justify-center lg:justify-end">
            <FlexCardShowcase />
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* MINIMAL FOOTER NOTE                                     */}
      {/* ======================================================= */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <div className="font-mono text-xs text-slate-500">
          It&apos;s a college project.
        </div>
      </footer>
    </main>
  )
}
