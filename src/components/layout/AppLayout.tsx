import React, { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import AppHeader from './AppHeader'
import { initSmoothScroll, scrollToTop, animatePageEntrance } from '../../lib/motion'

export interface AppLayoutProps {
  children: React.ReactNode
  hideBottomNav?: boolean
  hideHeader?: boolean
  maxWidth?: 'default' | 'narrow' | 'wide' | 'full' | string
  className?: string
  noPadding?: boolean
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  hideHeader = false,
  maxWidth = 'default',
  className = '',
  noPadding = false,
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

  const maxWidthClass =
    maxWidth === 'narrow'
      ? 'max-w-[1160px]'
      : maxWidth === 'wide'
      ? 'max-w-[1400px]'
      : maxWidth === 'full'
      ? 'max-w-full'
      : maxWidth.startsWith('max-w-')
      ? maxWidth
      : 'max-w-7xl'

  const paddingClass = noPadding
    ? ''
    : 'px-3 sm:px-5 lg:px-7 py-3 sm:py-5 lg:py-6 pb-6 sm:pb-8'

  return (
    <div className="min-h-screen bg-[#071a2b] text-[#050505] flex flex-col relative arena-bg-grid">
      {/* Top Header */}
      {!hideHeader && <AppHeader />}

      {/* Main Page Content */}
      <main
        ref={contentRef}
        className={`flex-1 w-full mx-auto ${maxWidthClass} ${paddingClass} ${className}`}
      >
        {children}
      </main>
    </div>
  )
}

export default AppLayout
