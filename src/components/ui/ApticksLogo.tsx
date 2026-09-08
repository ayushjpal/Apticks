import React from 'react'

export interface ApticksLogoProps {
  /**
   * 'mark': Isolated flame + 1/4-clock mark (default).
   * 'full': Complete flame-clock mark + APTICKS wordmark lockup.
   * 'icon': Compact / micro favicon-sized mark.
   */
  variant?: 'mark' | 'full' | 'icon'
  /**
   * For the full lockup: 'light' (navy text) or 'dark' (white text for dark backgrounds).
   * Defaults to 'light'.
   */
  theme?: 'dark' | 'light'
  className?: string
  alt?: string
  ariaHidden?: boolean
}

/**
 * ApticksLogo
 * Centralized brand asset component for Apticks.
 * Renders the approved locked brand assets with exact fidelity.
 */
export const ApticksLogo: React.FC<ApticksLogoProps> = ({
  variant = 'mark',
  theme = 'light',
  className = '',
  alt,
  ariaHidden = false,
}) => {
  let src = '/brand/apticks-mark.png'

  if (variant === 'icon') {
    src = '/brand/apticks-icon-192.png'
  } else if (variant === 'full') {
    src = theme === 'dark' ? '/brand/apticks-full-dark.png' : '/brand/apticks-full-transparent.png'
  }

  const effectiveAlt = ariaHidden ? '' : alt || (variant === 'full' ? 'Apticks — Speed Arena' : 'Apticks')

  return (
    <img
      src={src}
      alt={effectiveAlt}
      aria-hidden={ariaHidden ? 'true' : undefined}
      className={`object-contain select-none pointer-events-none ${className}`}
      loading="eager"
      decoding="async"
    />
  )
}

export default ApticksLogo
