import React from 'react'

export interface ApticksLogoProps {
  /**
   * 'mark': Isolated angular A + diagonal streak + star mark.
   * 'full': Complete mark + APTICKS SPEED ARENA brand lockup.
   * 'icon': Mark inside rounded dark navy container.
   * 'yellow-icon': Mark inside rounded Apticks yellow container.
   * 'monochrome': Single-color monochrome mark.
   */
  variant?: 'mark' | 'full' | 'icon' | 'yellow-icon' | 'monochrome'
  /**
   * For the lockup text: 'light' (navy text) or 'dark' (white text for dark backgrounds).
   * Defaults to 'dark'.
   */
  theme?: 'dark' | 'light'
  className?: string
  alt?: string
  ariaHidden?: boolean
}

/**
 * Apticks Angular Vector Mark
 * A = Apticks
 * Diagonal Streak = Speed / Progress
 * Star = Higher achievement / improvement
 */
export const ApticksMarkSvg: React.FC<{
  className?: string
  color?: 'default' | 'monochrome' | 'inverted'
}> = ({ className = 'w-8 h-8', color = 'default' }) => {
  const isMonochrome = color === 'monochrome'
  const isInverted = color === 'inverted'

  const legFill = isMonochrome ? 'currentColor' : isInverted ? '#071a2b' : '#ffffff'
  const streakFill = isMonochrome ? 'currentColor' : isInverted ? '#071a2b' : '#ffd43b'
  const starFill = isMonochrome ? 'currentColor' : isInverted ? '#071a2b' : '#ffd43b'

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {/* Left Leg of Angular A */}
      <path d="M 8.5 38 L 13.5 38 L 22 17 L 17 17 Z" fill={legFill} />

      {/* Apex & Right Leg of Angular A */}
      <path
        d="M 21.5 9 L 26.5 9 L 36.5 38 L 31.5 38 L 25.2 20 L 21.5 9 Z"
        fill={legFill}
      />

      {/* Dynamic Diagonal Speed / Progress Streak */}
      <path d="M 5 29.5 L 34 16 L 35.5 19.5 L 6.5 33 Z" fill={streakFill} />

      {/* 4-Point Star / Spark of Excellence */}
      <path
        d="M 37.5 4 C 37.5 8 41.5 8.5 41.5 8.5 C 41.5 8.5 37.5 9 37.5 13 C 37.5 9 33.5 8.5 33.5 8.5 C 33.5 8.5 37.5 8 37.5 4 Z"
        fill={starFill}
      />
    </svg>
  )
}

/**
 * ApticksLogo
 * Official brand asset component for Apticks.
 */
export const ApticksLogo: React.FC<ApticksLogoProps> = ({
  variant = 'mark',
  theme = 'dark',
  className = '',
  alt,
  ariaHidden = false,
}) => {
  const effectiveAlt = ariaHidden
    ? ''
    : alt || (variant === 'full' ? 'Apticks Speed Arena' : 'Apticks')

  if (variant === 'mark') {
    return (
      <div
        className={`inline-flex items-center justify-center ${className}`}
        aria-label={effectiveAlt}
        role={ariaHidden ? undefined : 'img'}
      >
        <ApticksMarkSvg className="w-full h-full" color="default" />
      </div>
    )
  }

  if (variant === 'icon') {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-[#0c1d2d] border border-slate-700/80 p-1.5 shadow-sm ${className}`}
        aria-label={effectiveAlt}
        role={ariaHidden ? undefined : 'img'}
      >
        <ApticksMarkSvg className="w-full h-full" color="default" />
      </div>
    )
  }

  if (variant === 'yellow-icon') {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-[#ffd43b] border border-[#ffd43b] p-1.5 shadow-sm ${className}`}
        aria-label={effectiveAlt}
        role={ariaHidden ? undefined : 'img'}
      >
        <ApticksMarkSvg className="w-full h-full" color="inverted" />
      </div>
    )
  }

  if (variant === 'monochrome') {
    return (
      <div
        className={`inline-flex items-center justify-center ${className}`}
        aria-label={effectiveAlt}
        role={ariaHidden ? undefined : 'img'}
      >
        <ApticksMarkSvg className="w-full h-full" color="monochrome" />
      </div>
    )
  }

  // variant === 'full': Complete brand lockup
  const textColor = theme === 'dark' ? 'text-white' : 'text-slate-900'

  return (
    <div
      className={`inline-flex items-center gap-3 select-none ${className}`}
      aria-label={effectiveAlt}
      role={ariaHidden ? undefined : 'img'}
    >
      <div className="w-9 h-9 rounded-xl bg-[#0c1d2d] border border-slate-700/80 p-1 flex items-center justify-center shrink-0 shadow-sm">
        <ApticksMarkSvg className="w-full h-full" color="default" />
      </div>

      <div className="flex flex-col text-left leading-none">
        <span
          className={`font-display font-extrabold text-base tracking-wider uppercase ${textColor}`}
        >
          APTICKS
        </span>
        <span className="font-mono text-[10px] font-bold tracking-widest text-[#ffd43b] uppercase mt-1">
          SPEED ARENA
        </span>
      </div>
    </div>
  )
}

export default ApticksLogo
