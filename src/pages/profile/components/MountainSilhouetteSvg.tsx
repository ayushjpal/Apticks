import React from 'react'

interface MountainSilhouetteSvgProps {
  className?: string
}

export const MountainSilhouetteSvg: React.FC<MountainSilhouetteSvgProps> = ({ className = '' }) => {
  return (
    <div className={`pointer-events-none select-none overflow-hidden ${className}`}>
      <svg
        viewBox="0 0 320 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        preserveAspectRatio="xMidYMax meet"
      >
        <defs>
          {/* Mountain ridge gradient 1 (far distance) */}
          <linearGradient id="ridgeFar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0b1726" stopOpacity="0.85" />
          </linearGradient>

          {/* Mountain ridge gradient 2 (mid distance with summit) */}
          <linearGradient id="ridgeMid" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#162e4c" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#091421" stopOpacity="0.9" />
          </linearGradient>

          {/* Foreground ridge */}
          <linearGradient id="ridgeFore" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f2238" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#070e18" stopOpacity="0.95" />
          </linearGradient>

          {/* Background subtle grid pattern */}
          <pattern id="skyGrid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Sky subtle coordinate grid */}
        <rect width="320" height="180" fill="url(#skyGrid)" />

        {/* Far Background Mountain */}
        <path
          d="M60 180 L140 105 L180 135 L250 48 L320 180 Z"
          fill="url(#ridgeFar)"
        />

        {/* Mid Mountain with Main Peak */}
        <path
          d="M0 180 L80 130 L160 155 L250 48 L320 120 L320 180 Z"
          fill="url(#ridgeMid)"
        />

        {/* Foreground Ridge */}
        <path
          d="M0 180 L40 150 L110 170 L200 135 L280 165 L320 150 L320 180 Z"
          fill="url(#ridgeFore)"
        />

        {/* Summit Flagpole & Pennant (Flat, Low Contrast) */}
        <g opacity="0.65">
          {/* Flagpole */}
          <line
            x1="250"
            y1="48"
            x2="250"
            y2="30"
            stroke="#ffd43b"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Triangular Pennant Flag */}
          <path
            d="M250 31 L268 37 L250 43 Z"
            fill="#ffd43b"
          />
          {/* Pole Finial Ball */}
          <circle cx="250" cy="29" r="1.5" fill="#ffd43b" />
        </g>
      </svg>
    </div>
  )
}
