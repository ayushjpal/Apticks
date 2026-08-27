import Lenis from 'lenis'
import gsap from 'gsap'

let lenisInstance: Lenis | null = null
let rafCallback: ((time: number) => void) | null = null

/**
 * Checks if user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Initializes single centralized Lenis smooth scroll instance.
 */
export function initSmoothScroll(): () => void {
  if (typeof window === 'undefined') return () => {}

  // Respect prefers-reduced-motion
  if (prefersReducedMotion()) {
    return () => {}
  }

  // If instance already exists, reuse it
  if (!lenisInstance) {
    lenisInstance = new Lenis({
      duration: 1.0,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
    })

    rafCallback = (time: number) => {
      lenisInstance?.raf(time * 1000)
    }

    gsap.ticker.add(rafCallback)
    gsap.ticker.lagSmoothing(0)
  }

  return () => {
    // Lenis instance cleanup if needed
  }
}

/**
 * Scroll to top on page navigation.
 */
export function scrollToTop(): void {
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { immediate: true })
  } else if (typeof window !== 'undefined') {
    window.scrollTo(0, 0)
  }
}

/**
 * Staggered entrance animation for page containers (150-300ms).
 */
export function animatePageEntrance(container: HTMLElement | null): void {
  if (!container || prefersReducedMotion()) return

  const elements = container.querySelectorAll('.animate-entry')
  if (elements.length === 0) return

  gsap.fromTo(
    elements,
    { opacity: 0, y: 12 },
    {
      opacity: 1,
      y: 0,
      duration: 0.28,
      stagger: 0.05,
      ease: 'power2.out',
      clearProps: 'all',
    }
  )
}
