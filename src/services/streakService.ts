import { supabase } from '../lib/supabase'
import type { UserStreak } from '../types/questions'

const STREAK_CACHE_PREFIX = 'apticks_user_streak_'

function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function getStoredStreak(userId: string): UserStreak | null {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(`${STREAK_CACHE_PREFIX}${userId}`)
      if (data) {
        return JSON.parse(data) as UserStreak
      }
    }
  } catch {
    // ignore
  }
  return null
}

function setStoredStreak(userId: string, streak: UserStreak): void {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STREAK_CACHE_PREFIX}${userId}`, JSON.stringify(streak))
    }
  } catch {
    // ignore
  }
}

export class StreakService {
  /**
   * Get user streak metrics with dynamic display resolution (Read-Only).
   * Will never silently mutate database rows.
   */
  static async getUserStreak(userId?: string): Promise<UserStreak> {
    const defaultStreak: UserStreak = {
      currentStreak: 0,
      longestStreak: 0,
      isActiveToday: false,
      isAtRisk: false,
      lastActiveDate: null,
    }

    if (!userId) {
      return defaultStreak
    }

    // 1. Return cached streak immediately for instant zero-flicker UI
    const cached = getStoredStreak(userId)
    const base = cached || defaultStreak

    // 2. Fetch authoritative display metrics from database RPC
    try {
      const tz = getClientTimezone()
      const { data, error } = await supabase.rpc('get_user_streak', {
        p_timezone: tz,
      })

      if (!error && data) {
        const streak: UserStreak = {
          currentStreak: Number(data.current_streak) || 0,
          longestStreak: Number(data.longest_streak) || 0,
          isActiveToday: Boolean(data.is_active_today),
          isAtRisk: Boolean(data.is_at_risk),
          lastActiveDate: data.last_active_date || null,
        }

        setStoredStreak(userId, streak)
        return streak
      }
    } catch (err) {
      console.warn('StreakService.getUserStreak error:', err)
    }

    return base
  }

  /**
   * Records meaningful activity (Question Bank correct solves) to advance/maintain streak.
   * Atomic, server-validated, and idempotent (same-day activity is a NO-OP).
   */
  static async recordDailyActivity(
    userId?: string
  ): Promise<{ success: boolean; streak: number; longestStreak: number; updated: boolean }> {
    if (!userId) {
      return { success: false, streak: 0, longestStreak: 0, updated: false }
    }

    try {
      const tz = getClientTimezone()
      const { data, error } = await supabase.rpc('record_streak_activity', {
        p_timezone: tz,
      })

      if (!error && data && data.success) {
        const streak = Number(data.streak) || 1
        const longestStreak = Number(data.longest_streak) || streak

        // Update local cache
        const updated: UserStreak = {
          currentStreak: streak,
          longestStreak,
          isActiveToday: true,
          isAtRisk: false,
          lastActiveDate: new Date().toISOString().split('T')[0],
        }
        setStoredStreak(userId, updated)

        return {
          success: true,
          streak,
          longestStreak,
          updated: Boolean(data.updated),
        }
      }
    } catch (err) {
      console.warn('StreakService.recordDailyActivity error:', err)
    }

    return { success: false, streak: 0, longestStreak: 0, updated: false }
  }
}
