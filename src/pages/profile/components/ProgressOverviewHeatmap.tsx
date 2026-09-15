import React, { useState, useMemo } from 'react'
import { Calendar } from 'lucide-react'
import type { UserQuestionAttempt } from '../../../types/questions'
import type { DailyChallengeCompletionRow } from './RecentActivityFeed'

interface ProgressOverviewHeatmapProps {
  attempts: UserQuestionAttempt[]
  challengeCompletions?: DailyChallengeCompletionRow[]
  totalEarnedXp: number
  totalProblems: number
  streakDays: number
}

interface HeatmapDay {
  dateStr: string // YYYY-MM-DD
  dayOfWeek: number // 0 = Mon, 6 = Sun
  monthName: string // "Sep"
  dayOfMonth: number
  isFuture: boolean
  attemptCount: number
  solvedCount: number
  challengeCount: number
  totalXp: number
  intensity: 0 | 1 | 2 | 3 | 4
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const ProgressOverviewHeatmap: React.FC<ProgressOverviewHeatmapProps> = ({
  attempts,
  challengeCompletions = [],
  totalEarnedXp,
  totalProblems,
  streakDays,
}) => {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null)

  // 1. Build a fast lookup map for real user activity by YYYY-MM-DD
  const activityMap = useMemo(() => {
    const map = new Map<
      string,
      { attemptCount: number; solvedCount: number; challengeCount: number; totalXp: number }
    >()

    const getOrCreate = (dateStr: string) => {
      if (!map.has(dateStr)) {
        map.set(dateStr, { attemptCount: 0, solvedCount: 0, challengeCount: 0, totalXp: 0 })
      }
      return map.get(dateStr)!
    }

    // Process practice attempts
    attempts.forEach((att) => {
      if (!att.createdAt) return
      const dateStr = att.createdAt.slice(0, 10)
      const entry = getOrCreate(dateStr)
      entry.attemptCount += 1
      if (att.isCorrect) {
        entry.solvedCount += 1
      }
      if (att.xpChange > 0) {
        entry.totalXp += att.xpChange
      }
    })

    // Process daily challenge completions
    challengeCompletions.forEach((comp) => {
      const dateStr =
        comp.challenge_date || (comp.completed_at ? comp.completed_at.slice(0, 10) : '')
      if (!dateStr) return
      const entry = getOrCreate(dateStr)
      entry.challengeCount += 1
      entry.totalXp += Number(comp.bonus_xp_awarded) || 50
    })

    return map
  }, [attempts, challengeCompletions])

  // 2. Generate exactly 10 weeks (70 days) ending on the current week's Sunday
  const { weeks, monthHeaders } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = today.toISOString().slice(0, 10)

    // Find current day of week (0 = Sun, 1 = Mon, ..., 6 = Sat)
    // Convert to 0 = Mon, ..., 6 = Sun
    const currentDayOfW = (today.getDay() + 6) % 7
    // End the grid on the Sunday of the current week
    const daysUntilEndOfWeek = 6 - currentDayOfW
    const endDate = new Date(today)
    endDate.setDate(today.getDate() + daysUntilEndOfWeek)

    // 10 weeks = 70 days total
    const totalDays = 70
    const startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - totalDays + 1)

    const generatedWeeks: HeatmapDay[][] = []
    let currentWeek: HeatmapDay[] = []
    const headers: { month: string; colIndex: number }[] = []
    let lastMonth = ''

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate)
      d.setDate(startDate.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const dayOfWeek = (d.getDay() + 6) % 7
      const monthName = d.toLocaleDateString('en-US', { month: 'short' })
      const dayOfMonth = d.getDate()
      const isFuture = dateStr > todayIso

      const stats = activityMap.get(dateStr) || {
        attemptCount: 0,
        solvedCount: 0,
        challengeCount: 0,
        totalXp: 0,
      }
      const totalActivities = stats.attemptCount + stats.challengeCount

      // Intensity level mapping (blue represents normal activity, amber for high/peak)
      let intensity: 0 | 1 | 2 | 3 | 4 = 0
      if (!isFuture && totalActivities > 0) {
        if (totalActivities >= 6 || stats.totalXp >= 80) {
          intensity = 4 // Peak
        } else if (totalActivities >= 4 || stats.totalXp >= 45) {
          intensity = 3 // High (restrained amber)
        } else if (totalActivities >= 2 || stats.totalXp >= 20) {
          intensity = 2 // Medium (stronger blue/cyan)
        } else {
          intensity = 1 // Low (subtle blue/slate)
        }
      }

      const dayObj: HeatmapDay = {
        dateStr,
        dayOfWeek,
        monthName,
        dayOfMonth,
        isFuture,
        attemptCount: stats.attemptCount,
        solvedCount: stats.solvedCount,
        challengeCount: stats.challengeCount,
        totalXp: stats.totalXp,
        intensity,
      }

      currentWeek.push(dayObj)

      if (currentWeek.length === 7) {
        const colIdx = generatedWeeks.length
        // Check if month changes in this column
        const firstDayOfMonthInCol = currentWeek.find((item) => item.dayOfMonth === 1)
        if (firstDayOfMonthInCol && firstDayOfMonthInCol.monthName !== lastMonth) {
          headers.push({ month: firstDayOfMonthInCol.monthName, colIndex: colIdx })
          lastMonth = firstDayOfMonthInCol.monthName
        } else if (colIdx === 0) {
          headers.push({ month: currentWeek[0].monthName, colIndex: 0 })
          lastMonth = currentWeek[0].monthName
        }

        generatedWeeks.push(currentWeek)
        currentWeek = []
      }
    }

    return { weeks: generatedWeeks, monthHeaders: headers }
  }, [activityMap])

  return (
    <div className="bg-[#091522] border border-white/10 rounded-2xl p-4 sm:p-5 text-white flex flex-col justify-between h-full relative">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            <h3 className="font-display font-bold text-sm text-white">
              Progress Overview
            </h3>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span>Last 10 Weeks</span>
          </div>
        </div>

        {/* Heatmap Grid Container */}
        <div className="w-full overflow-x-auto no-scrollbar pb-1">
          <div className="min-w-[320px] max-w-full">
            {/* Month Labels Row */}
            <div className="flex pl-7 text-[10px] font-mono text-slate-400 h-4 mb-1">
              {weeks.map((_, colIdx) => {
                const header = monthHeaders.find((h) => h.colIndex === colIdx)
                return (
                  <div
                    key={`month-${colIdx}`}
                    className="flex-1 text-left truncate font-semibold"
                  >
                    {header ? header.month : ''}
                  </div>
                )
              })}
            </div>

            {/* 7 Weekday Rows × 10 Weeks Columns */}
            <div className="flex gap-1.5">
              {/* Day Labels Column */}
              <div className="flex flex-col justify-between text-[9px] font-mono text-slate-400 pr-1 w-6 shrink-0 select-none py-0.5">
                {WEEKDAYS.map((day, idx) => (
                  <span
                    key={day}
                    className={`leading-none h-3.5 flex items-center ${
                      idx % 2 === 0 ? 'text-slate-400' : 'opacity-0'
                    }`}
                  >
                    {day}
                  </span>
                ))}
              </div>

              {/* 10 Week Columns */}
              <div className="flex flex-1 gap-1 sm:gap-1.5">
                {weeks.map((week, colIdx) => (
                  <div
                    key={`week-${colIdx}`}
                    className="flex flex-col flex-1 gap-1 sm:gap-1.5"
                  >
                    {week.map((day) => {
                      let cellClass: string

                      if (day.isFuture) {
                        cellClass = 'bg-transparent border border-white/[0.02] opacity-30 cursor-default'
                      } else if (day.intensity === 1) {
                        // Level 1: Low activity (subtle blue/slate)
                        cellClass = 'bg-sky-950/70 border border-sky-900/50 hover:border-sky-400/60'
                      } else if (day.intensity === 2) {
                        // Level 2: Medium activity (stronger blue/cyan)
                        cellClass = 'bg-sky-800/70 border border-sky-500/50 hover:border-sky-300'
                      } else if (day.intensity === 3) {
                        // Level 3: High activity (restrained amber)
                        cellClass = 'bg-amber-900/70 border border-amber-500/50 hover:border-amber-300'
                      } else if (day.intensity === 4) {
                        // Level 4: Peak activity (stronger amber)
                        cellClass = 'bg-amber-500/50 border border-amber-400/80 hover:border-amber-200'
                      } else {
                        // Level 0: No activity
                        cellClass = 'bg-slate-800/40 border border-white/[0.05] hover:border-white/20'
                      }

                      return (
                        <div
                          key={day.dateStr}
                          onMouseEnter={() => !day.isFuture && setHoveredDay(day)}
                          onMouseLeave={() => setHoveredDay(null)}
                          className={`aspect-square w-full rounded-[3px] transition-colors cursor-pointer ${cellClass}`}
                          title={`${day.dateStr}: ${
                            day.attemptCount + day.challengeCount > 0
                              ? `${day.attemptCount + day.challengeCount} activities, +${day.totalXp} XP`
                              : 'No activity'
                          }`}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center justify-between mt-3 text-[10px] font-mono text-slate-400 pl-7">
              <span className="truncate">
                {hoveredDay ? (
                  <span className="text-slate-200">
                    <strong className="text-white font-semibold">{hoveredDay.dateStr}</strong>:{' '}
                    {hoveredDay.attemptCount + hoveredDay.challengeCount === 0 ? (
                      <span className="text-slate-400">No activity recorded</span>
                    ) : (
                      <span>
                        <span className="text-sky-300">
                          {hoveredDay.attemptCount + hoveredDay.challengeCount} action
                          {hoveredDay.attemptCount + hoveredDay.challengeCount > 1 ? 's' : ''}
                        </span>
                        {hoveredDay.solvedCount > 0 && (
                          <span className="text-emerald-400 ml-1.5">
                            ({hoveredDay.solvedCount} solved)
                          </span>
                        )}
                        {hoveredDay.totalXp > 0 && (
                          <span className="text-amber-300 ml-1.5">
                            +{hoveredDay.totalXp} XP
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                ) : (
                  <span>Hover a cell to inspect real activity</span>
                )}
              </span>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="text-slate-400 text-[9px]">Less</span>
                <span className="w-2.5 h-2.5 rounded-[2px] bg-slate-800/40 border border-white/[0.05]" />
                <span className="w-2.5 h-2.5 rounded-[2px] bg-sky-950/70 border border-sky-900/50" />
                <span className="w-2.5 h-2.5 rounded-[2px] bg-sky-800/70 border border-sky-500/50" />
                <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-900/70 border border-amber-500/50" />
                <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-500/50 border border-amber-400/80" />
                <span className="text-slate-400 text-[9px]">More</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap Compact Inline Summary (No separate cards, no colored boxes) */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-center gap-4 text-xs font-mono text-slate-300">
        <div className="flex items-center gap-1.5">
          <span className="text-amber-300 font-bold">{totalEarnedXp}</span>
          <span className="text-slate-400">XP</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold">{totalProblems}</span>
          <span className="text-slate-400">Problems</span>
        </div>
        <span className="text-slate-600">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold">{streakDays}d</span>
          <span className="text-slate-400">Streak</span>
        </div>
      </div>
    </div>
  )
}
