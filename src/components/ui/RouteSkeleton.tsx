import React from 'react'

export const RouteSkeleton: React.FC = () => {
  return (
    <div className="w-full space-y-5 animate-pulse pb-10">
      {/* Top Header Skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-28 bg-white/10 rounded-md" />
        <div className="h-7 w-56 bg-white/15 rounded-lg" />
        <div className="h-3.5 w-72 bg-white/10 rounded-md" />
      </div>

      {/* Metric Cards Skeleton Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-20 bg-[#0c1d2d]/80 border border-white/10 rounded-xl p-3 space-y-2"
          >
            <div className="h-2.5 w-16 bg-white/10 rounded" />
            <div className="h-6 w-20 bg-white/15 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content Card Skeleton */}
      <div className="bg-[#0c1d2d]/80 border border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="h-4 w-36 bg-white/15 rounded" />
          <div className="h-4 w-20 bg-white/10 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-12 bg-white/5 rounded-xl border border-white/5" />
          <div className="h-12 bg-white/5 rounded-xl border border-white/5" />
          <div className="h-12 bg-white/5 rounded-xl border border-white/5" />
        </div>
      </div>
    </div>
  )
}

export const ArenaSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#071a2b] text-white flex flex-col justify-between p-4 sm:p-6 animate-pulse arena-bg-grid">
      {/* Top Arena HUD Bar Skeleton */}
      <div className="h-14 bg-[#0c1d2d] border border-white/10 rounded-xl flex items-center justify-between px-4">
        <div className="h-5 w-28 bg-white/15 rounded" />
        <div className="h-8 w-20 bg-[#ffd43b]/20 border border-[#ffd43b]/40 rounded-lg" />
        <div className="h-5 w-28 bg-white/15 rounded" />
      </div>

      {/* Center Question Area Skeleton */}
      <div className="max-w-3xl w-full mx-auto my-auto space-y-4 p-6 bg-[#0c1d2d]/90 border border-white/10 rounded-2xl">
        <div className="h-4 w-32 bg-white/10 rounded" />
        <div className="h-6 w-full bg-white/15 rounded" />
        <div className="h-6 w-3/4 bg-white/15 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
          <div className="h-12 bg-white/5 border border-white/10 rounded-xl" />
          <div className="h-12 bg-white/5 border border-white/10 rounded-xl" />
          <div className="h-12 bg-white/5 border border-white/10 rounded-xl" />
          <div className="h-12 bg-white/5 border border-white/10 rounded-xl" />
        </div>
      </div>

      {/* Bottom Status Bar Skeleton */}
      <div className="h-10 bg-[#0c1d2d]/60 border border-white/5 rounded-lg flex items-center justify-between px-4">
        <div className="h-3 w-24 bg-white/10 rounded" />
        <div className="h-3 w-32 bg-white/10 rounded" />
      </div>
    </div>
  )
}

export const AuthSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#071a2b] flex items-center justify-center p-4 animate-pulse arena-bg-grid">
      <div className="w-full max-w-4xl h-[480px] bg-[#0c1d2d] border border-white/10 rounded-3xl grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] overflow-hidden">
        <div className="bg-[#091522] p-8 hidden lg:flex flex-col justify-between border-r border-white/10">
          <div className="h-8 w-28 bg-white/15 rounded-lg" />
          <div className="space-y-3">
            <div className="h-6 w-48 bg-white/15 rounded" />
            <div className="h-3 w-64 bg-white/10 rounded" />
          </div>
          <div className="h-4 w-32 bg-white/10 rounded" />
        </div>
        <div className="p-8 flex flex-col justify-center space-y-4">
          <div className="h-7 w-40 bg-white/20 rounded" />
          <div className="h-3.5 w-60 bg-white/10 rounded" />
          <div className="h-11 bg-white/5 border border-white/10 rounded-xl mt-4" />
          <div className="h-11 bg-white/5 border border-white/10 rounded-xl" />
          <div className="h-11 bg-[#ffd43b]/20 border border-[#ffd43b]/40 rounded-xl mt-2" />
        </div>
      </div>
    </div>
  )
}

export default RouteSkeleton
