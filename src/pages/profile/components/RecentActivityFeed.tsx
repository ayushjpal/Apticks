import React, { useState } from 'react'
import { Zap, CheckCircle2, Flame, XCircle, ArrowRight } from 'lucide-react'
import type { UserQuestionAttempt } from '../../../types/questions'

export interface DailyChallengeCompletionRow {
  challenge_date: string
  bonus_xp_awarded: number
  completed_at: string
}

export interface ActivityItem {
  id: string
  type: 'challenge' | 'practice_correct' | 'practice_incorrect'
  title: string
  timestamp: string // ISO string
  xpChange: number
}

interface RecentActivityFeedProps {
  attempts: UserQuestionAttempt[]
  challengeCompletions?: DailyChallengeCompletionRow[]
}

function formatRelativeTime(dateString: string): string {
  try {
    const then = new Date(dateString).getTime()
    const now = Date.now()
    const diffMs = Math.max(0, now - then)
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours === 1) return '1 hour ago'
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 1) return '1 day ago'
    return `${diffDays} days ago`
  } catch {
    return 'Recently'
  }
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  attempts,
  challengeCompletions = [],
}) => {
  const [showAll, setShowAll] = useState(false)

  // Merge real activity events chronologically
  const activities: ActivityItem[] = []

  // 1. Practice attempts
  attempts.forEach((att) => {
    activities.push({
      id: `att-${att.id}`,
      type: att.isCorrect ? 'practice_correct' : 'practice_incorrect',
      title: att.isCorrect ? 'Solved a practice problem' : 'Attempted a problem',
      timestamp: att.createdAt,
      xpChange: att.xpChange,
    })
  })

  // 2. Daily Challenge completions
  challengeCompletions.forEach((comp, idx) => {
    activities.push({
      id: `dc-${comp.challenge_date}-${idx}`,
      type: 'challenge',
      title: 'Completed Daily Challenge',
      timestamp: comp.completed_at || `${comp.challenge_date}T12:00:00Z`,
      xpChange: comp.bonus_xp_awarded || 50,
    })
  })

  // Sort descending by timestamp
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const displayedActivities = showAll ? activities.slice(0, 15) : activities.slice(0, 4)

  return (
    <div className="bg-[#091522] border border-white/10 rounded-2xl p-4 sm:p-5 text-white flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-400" />
            <h3 className="font-display font-bold text-sm text-white">
              Recent Activity
            </h3>
          </div>
          {activities.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="font-mono text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>{showAll ? 'Collapse' : 'View All'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Activity List (Timeline format with subtle 1px dividers, no individual cards) */}
        {activities.length === 0 ? (
          <div className="py-8 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl font-mono text-xs text-slate-400">
            No activity recorded yet. Start solving problems to build your history!
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {displayedActivities.map((act) => {
              let iconBox = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              let Icon = CheckCircle2
              let xpTextClass = 'text-emerald-400'
              let xpPrefix = '+'

              if (act.type === 'challenge') {
                iconBox = 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                Icon = Flame
                xpTextClass = 'text-[#ffd43b]'
                xpPrefix = '+'
              } else if (act.type === 'practice_incorrect') {
                iconBox = 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                Icon = XCircle
                xpTextClass = 'text-rose-400'
                xpPrefix = ''
              }

              return (
                <div
                  key={act.id}
                  className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 ${iconBox}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-semibold text-xs text-white truncate">
                        {act.title}
                      </div>
                      <div
                        className="font-mono text-[10px] text-slate-400 mt-0.5"
                        title={new Date(act.timestamp).toLocaleString()}
                        data-timestamp={act.timestamp}
                      >
                        {formatRelativeTime(act.timestamp)}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 font-mono font-bold text-xs text-right">
                    <span className={xpTextClass}>
                      {xpPrefix}{act.xpChange} XP
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

