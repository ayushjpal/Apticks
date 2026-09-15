import React from 'react'
import { BarChart2 } from 'lucide-react'
import type { LevelProgress } from '../../../utils/levelEngine'
import type { QuestionBankStats } from '../../../types/questions'
import { MountainSilhouetteSvg } from './MountainSilhouetteSvg'

interface CompetitiveHeroCardProps {
  levelProgress: LevelProgress | null
  questionStats: QuestionBankStats | null
}

export const CompetitiveHeroCard: React.FC<CompetitiveHeroCardProps> = ({
  levelProgress,
  questionStats,
}) => {
  const levelNum = levelProgress?.level ?? 1
  const levelStr = String(levelNum).padStart(2, '0')
  const tierTitle = levelProgress?.title ?? 'NOVICE'
  const currentXp = levelProgress?.xpInLevel ?? 0
  const nextLevelSpan =
    (levelProgress?.nextLevelXp ?? 100) - (levelProgress?.currentLevelXp ?? 0)
  const progressPercent = levelProgress?.progressPercentage ?? 0
  const xpRequired = levelProgress?.xpRequired ?? 30
  const nextLevelNum = String(levelNum + 1).padStart(2, '0')
  const totalXp = levelProgress?.totalXp ?? questionStats?.totalPoints ?? 0

  return (
    <div className="bg-[#091522] border border-white/10 rounded-2xl lg:rounded-3xl p-4 sm:p-5 lg:p-6 relative overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch relative z-10">
        {/* ========================================================= */}
        {/* COLUMN 1: LEVEL & PROGRESSION (~42% / 5 Cols)             */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 flex flex-col justify-between relative min-h-[240px] pb-1 lg:border-r lg:border-white/10 lg:pr-8">
          {/* Mountain SVG Silhouette in Background (Atmospheric, Low Contrast) */}
          <MountainSilhouetteSvg className="absolute -right-2 -top-1 w-56 sm:w-64 h-32 opacity-40 lg:opacity-50" />

          <div>
            {/* Level Heading */}
            <div className="relative z-10">
              <div className="font-display font-black text-3xl sm:text-4xl tracking-tight leading-none">
                <span className="text-white">LEVEL </span>
                <span className="text-sky-400">{levelStr}</span>
              </div>
              <div className="font-mono text-xs sm:text-sm font-bold tracking-[0.2em] text-amber-400 uppercase mt-1.5">
                {tierTitle}
              </div>
            </div>

            {/* Numerical XP & Progress Bar (Flat, Zero Glow) */}
            <div className="mt-10 sm:mt-12">
              <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                <span className="font-bold text-slate-300">
                  {currentXp} / {nextLevelSpan} XP
                </span>
                <span className="font-bold text-slate-300">
                  {progressPercent}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800/80 border border-white/10 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-sky-500/80 to-amber-400/80 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Next Milestone Row (Clean text row, no card, no chevron) */}
          <div className="mt-6 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 font-medium">NEXT MILESTONE</span>
            <span className="text-slate-200 font-bold">
              <span className="text-amber-300">{xpRequired} XP</span> TO LEVEL {nextLevelNum}
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUMN 2: PERFORMANCE METRICS (~58% / 7 Cols)             */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-sky-400" />
            <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
              PERFORMANCE
            </h2>
          </div>

          {/* Compact Structured Metric Blocks (Not spreadsheet, Not oversized) */}
          <div className="flex-1 flex flex-col justify-between gap-2.5 pt-0.5">
            {/* 2x2 Grid: Attempts, Correct, Incorrect, Accuracy */}
            <div className="grid grid-cols-2 gap-2">
              {/* Attempts */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 sm:p-3 flex flex-col justify-between">
                <span className="font-mono font-bold text-xl sm:text-2xl text-white leading-tight">
                  {questionStats?.totalAttempts ?? 0}
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mt-1">
                  ATTEMPTS
                </span>
              </div>

              {/* Correct */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 sm:p-3 flex flex-col justify-between">
                <span className="font-mono font-bold text-xl sm:text-2xl text-emerald-400 leading-tight">
                  {questionStats?.correctAttempts ?? 0}
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mt-1">
                  CORRECT
                </span>
              </div>

              {/* Incorrect */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 sm:p-3 flex flex-col justify-between">
                <span className="font-mono font-bold text-xl sm:text-2xl text-rose-400 leading-tight">
                  {questionStats?.incorrectAttempts ?? 0}
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mt-1">
                  INCORRECT
                </span>
              </div>

              {/* Accuracy (Primary Signal with subtle gold emphasis) */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 sm:p-3 flex flex-col justify-between">
                <span className="font-mono font-black text-xl sm:text-2xl text-amber-300 leading-tight">
                  {questionStats?.accuracyRate ?? 0}%
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mt-1">
                  ACCURACY
                </span>
              </div>
            </div>

            {/* Compact XP Row (1x2 Grid): XP Earned & XP Penalty */}
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 px-3 flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-sm sm:text-base text-emerald-400">
                  +{questionStats?.xpEarned ?? 0} XP
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                  XP EARNED
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-sm sm:text-base text-rose-400">
                  -{questionStats?.xpLost ?? 0} XP
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                  XP PENALTY
                </span>
              </div>
            </div>

            {/* Total XP Bar */}
            <div className="pt-1.5 flex items-baseline justify-between border-t border-white/[0.08]">
              <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider">
                TOTAL XP
              </span>
              <span className="font-display font-black text-2xl text-amber-300 leading-none">
                {totalXp} <span className="text-xs font-mono text-slate-400 font-bold">XP</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

