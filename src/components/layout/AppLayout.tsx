import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import AppHeader from './AppHeader'
import BottomNavbar from './BottomNavbar'
import { initSmoothScroll, scrollToTop, animatePageEntrance } from '../../lib/motion'

export interface AppLayoutProps {
  children: React.ReactNode
  hideBottomNav?: boolean
  hideHeader?: boolean
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  hideBottomNav = false,
  hideHeader = false,
}) => {
  const location = useLocation()
  const contentRef = useRef<HTMLDivElement | null>(null)

  // Initialize Lenis smooth scroll once
  useEffect(() => {
    const cleanup = initSmoothScroll()
    return () => {
      cleanup()
    }
  }, [])

  // Scroll to top and animate on route navigation
  useEffect(() => {
    scrollToTop()
    if (contentRef.current) {
      animatePageEntrance(contentRef.current)
    }
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-[#071a2b] text-[#050505] flex flex-col relative arena-bg-grid">
      {/* Top Header */}
      {!hideHeader && <AppHeader />}

      {/* Main Page Content */}
      <main
        ref={contentRef}
        className={`
          flex-1 w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-3 sm:py-5 lg:py-6
          ${!hideBottomNav ? 'pb-16 sm:pb-20' : 'pb-8'}
        `}
      >
        {children}
      </main>

      {/* Floating Bottom Navigation */}
      {!hideBottomNav && <BottomNavbar />}
    </div>
  )
}

export default AppLayout
