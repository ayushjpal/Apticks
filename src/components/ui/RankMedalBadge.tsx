import React from 'react';

interface RankMedalBadgeProps {
  rank: 1 | 2 | 3;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const RankMedalBadge: React.FC<RankMedalBadgeProps> = ({
  rank,
  className = '',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-12 h-10',
    md: 'w-[62px] h-[52px]',
    lg: 'w-[68px] h-[56px]',
  }[size];

  if (rank === 1) {
    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}>
        <svg
          viewBox="0 0 64 54"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_4px_14px_rgba(168,85,247,0.45)] transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            {/* Metallic Gold Trim Gradient */}
            <linearGradient id="c1-gold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fffbeb" />
              <stop offset="25%" stopColor="#fde047" />
              <stop offset="60%" stopColor="#ca8a04" />
              <stop offset="100%" stopColor="#713f12" />
            </linearGradient>

            {/* Radiant Gold Horizontal */}
            <linearGradient id="c1-gold-h" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a16207" />
              <stop offset="50%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#a16207" />
            </linearGradient>

            {/* Left & Right Purple Wings */}
            <linearGradient id="c1-wing-l" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="45%" stopColor="#7e22ce" />
              <stop offset="85%" stopColor="#3b0764" />
              <stop offset="100%" stopColor="#1e0538" />
            </linearGradient>
            <linearGradient id="c1-wing-r" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="45%" stopColor="#7e22ce" />
              <stop offset="85%" stopColor="#3b0764" />
              <stop offset="100%" stopColor="#1e0538" />
            </linearGradient>

            {/* Deep Royal Purple Shield Core */}
            <linearGradient id="c1-shield" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#581c87" />
              <stop offset="40%" stopColor="#2e1065" />
              <stop offset="85%" stopColor="#17042e" />
              <stop offset="100%" stopColor="#0c011a" />
            </linearGradient>

            {/* Upper Specular Light Cut */}
            <linearGradient id="c1-specular" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            <filter id="c1-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#c084fc" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* Symmetrical Left Wing Outer Fin */}
          <path
            d="M 22 10 L 7 13 L 2 23 L 8 32 L 18 28 L 20 19 Z"
            fill="url(#c1-wing-l)"
            stroke="url(#c1-gold)"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* Left Wing Inner Tier */}
          <path
            d="M 22 16 L 11 19 L 7 25 L 14 29 L 20 25 Z"
            fill="#6b21a8"
            stroke="#fde047"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />

          {/* Symmetrical Right Wing Outer Fin (Mirrored) */}
          <path
            d="M 42 10 L 57 13 L 62 23 L 56 32 L 46 28 L 44 19 Z"
            fill="url(#c1-wing-r)"
            stroke="url(#c1-gold)"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* Right Wing Inner Tier (Mirrored) */}
          <path
            d="M 42 16 L 53 19 L 57 25 L 50 29 L 44 25 Z"
            fill="#6b21a8"
            stroke="#fde047"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />

          {/* Central Hexagonal Shield — Outer Polished Gold Bevel */}
          <path
            d="M 32 5 L 45 13 L 45 36 L 32 50 L 19 36 L 19 13 Z"
            fill="url(#c1-gold)"
            filter="url(#c1-glow)"
          />

          {/* Central Shield — Inner Deep Purple Core */}
          <path
            d="M 32 7.5 L 43 14.5 L 43 34.5 L 32 47 L 21 34.5 L 21 14.5 Z"
            fill="url(#c1-shield)"
          />

          {/* Inner Facet / Diamond Cut */}
          <path
            d="M 32 13.5 L 40.5 19.5 L 40.5 32.5 L 32 42 L 23.5 32.5 L 23.5 19.5 Z"
            stroke="#c084fc"
            strokeWidth="0.75"
            strokeOpacity="0.65"
            fill="rgba(168,85,247,0.12)"
          />

          {/* Sculpted Champion Crown Detail on Shield Peak */}
          <path
            d="M 25 11 L 28 6.5 L 32 10 L 36 6.5 L 39 11 L 32 8.5 Z"
            fill="url(#c1-gold-h)"
            stroke="#713f12"
            strokeWidth="0.5"
          />
          {/* Center Crown Ruby Accent */}
          <circle cx="32" cy="7.5" r="0.9" fill="#f43f5e" />

          {/* Specular White Rim Highlight */}
          <path
            d="M 21.5 14 L 32 7.5 L 42.5 14"
            stroke="url(#c1-specular)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Central High-Contrast Rank Typography */}
          <text
            x="32"
            y="31"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fffbeb"
            fontWeight="900"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            fontSize="13"
            letterSpacing="-0.5"
            style={{
              filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.95)) drop-shadow(0 0 5px rgba(250,204,21,0.55))',
            }}
          >
            #01
          </text>
        </svg>
      </div>
    );
  }

  if (rank === 2) {
    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}>
        <svg
          viewBox="0 0 64 54"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_4px_14px_rgba(6,182,212,0.45)] transition-transform duration-300 group-hover:scale-105"
        >
          <defs>
            {/* Crystalline Silver-Cyan Gradient */}
            <linearGradient id="c2-silver" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor="#cffafe" />
              <stop offset="65%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>

            {/* Ice Blue Wing Primary */}
            <linearGradient id="c2-wing-l" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#a5f3fc" />
              <stop offset="45%" stopColor="#0284c7" />
              <stop offset="85%" stopColor="#082f49" />
              <stop offset="100%" stopColor="#021727" />
            </linearGradient>
            <linearGradient id="c2-wing-r" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a5f3fc" />
              <stop offset="45%" stopColor="#0284c7" />
              <stop offset="85%" stopColor="#082f49" />
              <stop offset="100%" stopColor="#021727" />
            </linearGradient>

            {/* Deep Diamond Glass Core */}
            <linearGradient id="c2-core" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="45%" stopColor="#082f49" />
              <stop offset="100%" stopColor="#021220" />
            </linearGradient>

            {/* Specular White Sheen */}
            <linearGradient id="c2-specular" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>

            <filter id="c2-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#06b6d4" floodOpacity="0.45" />
            </filter>
          </defs>

          {/* Left Wing (Razor Ice Crystal) */}
          <path
            d="M 22 11 L 6 9 L 2 20 L 9 31 L 18 28 L 20 18 Z"
            fill="url(#c2-wing-l)"
            stroke="url(#c2-silver)"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* Left Wing Inner Layer */}
          <path
            d="M 22 17 L 11 17.5 L 7 24 L 14 29 L 20 25 Z"
            fill="#0369a1"
            stroke="#67e8f9"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />

          {/* Right Wing (Razor Ice Crystal - Mirrored) */}
          <path
            d="M 42 11 L 58 9 L 62 20 L 55 31 L 46 28 L 44 18 Z"
            fill="url(#c2-wing-r)"
            stroke="url(#c2-silver)"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          {/* Right Wing Inner Layer (Mirrored) */}
          <path
            d="M 42 17 L 53 17.5 L 57 24 L 50 29 L 44 25 Z"
            fill="#0369a1"
            stroke="#67e8f9"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />

          {/* Central Rhombus Diamond — Outer Silver Bezel */}
          <path
            d="M 32 4 L 47 23 L 32 50 L 17 23 Z"
            fill="url(#c2-silver)"
            filter="url(#c2-glow)"
          />

          {/* Central Rhombus Diamond — Inner Ice Blue Core */}
          <path
            d="M 32 6.8 L 44.5 23 L 32 46.5 L 19.5 23 Z"
            fill="url(#c2-core)"
          />

          {/* Faceted Internal Crystal Cuts */}
          <path
            d="M 32 13 L 39.5 23 L 32 37 L 24.5 23 Z"
            stroke="#67e8f9"
            strokeWidth="0.75"
            strokeOpacity="0.75"
            fill="rgba(6,182,212,0.12)"
          />
          {/* Crystal Axes */}
          <line x1="32" y1="7" x2="32" y2="46" stroke="#cffafe" strokeWidth="0.6" strokeOpacity="0.6" />
          <line x1="19.5" y1="23" x2="44.5" y2="23" stroke="#cffafe" strokeWidth="0.6" strokeOpacity="0.6" />

          {/* Upper Specular Bevel Highlights */}
          <path
            d="M 18.5 22 L 32 6 L 45.5 22"
            stroke="url(#c2-specular)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Central High-Contrast Rank Typography */}
          <text
            x="32"
            y="30"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#ffffff"
            fontWeight="900"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
            fontSize="13"
            letterSpacing="-0.5"
            style={{
              filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.95)) drop-shadow(0 0 5px rgba(6,182,212,0.65))',
            }}
          >
            #02
          </text>
        </svg>
      </div>
    );
  }

  // Rank 3 — Metallic Gold / Bronze
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${sizeClasses} ${className}`}>
      <svg
        viewBox="0 0 64 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_4px_14px_rgba(245,158,11,0.45)] transition-transform duration-300 group-hover:scale-105"
      >
        <defs>
          {/* Metallic Warm Gold Gradient */}
          <linearGradient id="c3-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="30%" stopColor="#fbbf24" />
            <stop offset="70%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          {/* Bronze Wing Primary */}
          <linearGradient id="c3-wing-l" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="40%" stopColor="#b45309" />
            <stop offset="85%" stopColor="#451a03" />
            <stop offset="100%" stopColor="#1f0901" />
          </linearGradient>
          <linearGradient id="c3-wing-r" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="40%" stopColor="#b45309" />
            <stop offset="85%" stopColor="#451a03" />
            <stop offset="100%" stopColor="#1f0901" />
          </linearGradient>

          {/* Deep Bronze Shield Core */}
          <linearGradient id="c3-core" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#78350f" />
            <stop offset="50%" stopColor="#451a03" />
            <stop offset="100%" stopColor="#1a0701" />
          </linearGradient>

          {/* Specular White/Gold Sheen */}
          <linearGradient id="c3-specular" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#fef08a" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <filter id="c3-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#f59e0b" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Symmetrical Left Wing Outer Fin */}
        <path
          d="M 22 11 L 7 12.5 L 2 22 L 9 32 L 18 28 L 20 19 Z"
          fill="url(#c3-wing-l)"
          stroke="url(#c3-gold)"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        {/* Left Wing Inner Tier */}
        <path
          d="M 22 17 L 12 18.5 L 8 25 L 15 30 L 20 26 Z"
          fill="#92400e"
          stroke="#fde047"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />

        {/* Symmetrical Right Wing Outer Fin (Mirrored) */}
        <path
          d="M 42 11 L 57 12.5 L 62 22 L 55 32 L 46 28 L 44 19 Z"
          fill="url(#c3-wing-r)"
          stroke="url(#c3-gold)"
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        {/* Right Wing Inner Tier (Mirrored) */}
        <path
          d="M 42 17 L 52 18.5 L 56 25 L 49 30 L 44 26 Z"
          fill="#92400e"
          stroke="#fde047"
          strokeWidth="0.7"
          strokeLinejoin="round"
        />

        {/* Central Shield — Outer Polished Gold Bevel */}
        <path
          d="M 32 5.5 C 39.5 5.5 45 7.5 46 13 C 46 28.5 39.5 42 32 49.5 C 24.5 42 18 28.5 18 13 C 19 7.5 24.5 5.5 32 5.5 Z"
          fill="url(#c3-gold)"
          filter="url(#c3-glow)"
        />

        {/* Central Shield — Inner Deep Bronze Core */}
        <path
          d="M 32 8 C 37.5 8 42.5 10 43.2 14.5 C 43.2 26.5 37.5 38.5 32 45.5 C 26.5 38.5 20.8 26.5 20.8 14.5 C 21.5 10 26.5 8 32 8 Z"
          fill="url(#c3-core)"
        />

        {/* Inner Gold Accent Ring */}
        <path
          d="M 32 14 C 36 14 39.5 15.5 39.5 19.5 C 39.5 26 36 34 32 39 C 28 34 24.5 26 24.5 19.5 C 24.5 15.5 28 14 32 14 Z"
          stroke="#fde047"
          strokeWidth="0.75"
          strokeOpacity="0.7"
          fill="rgba(245,158,11,0.12)"
        />

        {/* Upper Specular Bevel Highlights */}
        <path
          d="M 21 13 C 25 7.5 39 7.5 43 13"
          stroke="url(#c3-specular)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* Central High-Contrast Rank Typography */}
        <text
          x="32"
          y="30"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fffbeb"
          fontWeight="900"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          fontSize="13"
          letterSpacing="-0.5"
          style={{
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.95)) drop-shadow(0 0 5px rgba(245,158,11,0.6))',
          }}
        >
          #03
        </text>
      </svg>
    </div>
  );
};
