import { supabase } from '../lib/supabase'
import type { UserStreak } from '../types/questions'

interface CachedStreak {
  userId: string
  streak: UserStreak
  timestamp: number
}

// In-memory SWR cache (no sensitive user data in localStorage)
interface InFlightStreak {
  promise: Promise<UserStreak>
  generation: number
  isForced: boolean
}

let memoryStreakCache: CachedStreak | null = null
const inFlightStreakRequests = new Map<string, InFlightStreak>()
const streakGenerations = new Map<string, number>()
const STREAK_CACHE_TTL = 60 * 1000 // 60 seconds

function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const DEFAULT_STREAK: UserStreak = {
  currentStreak: 0,
  longestStreak: 0,
  isActiveToday: false,
  isAtRisk: false,
  lastActiveDate: null,
}

export class StreakService {
  /**
   * Invalidate in-memory streak cache (e.g. after mutations) with generation bump
   */
  static invalidateStreakCache(userId?: string): void {
    if (userId) {
      if (memoryStreakCache?.userId === userId) {
        memoryStreakCache = null
      }
      const nextGen = (streakGenerations.get(userId) ?? 0) + 1
      streakGenerations.set(userId, nextGen)
      inFlightStreakRequests.delete(userId)
    } else {
      memoryStreakCache = null
      streakGenerations.clear()
      inFlightStreakRequests.clear()
    }
  }

  /**
   * Get user streak metrics with dynamic display resolution (Read-Only).
   * Implements in-memory SWR caching and in-flight request deduplication with generation protection.
   */
  static async getUserStreak(userId?: string, forceRefresh = false): Promise<UserStreak> {
    if (!userId) {
      return DEFAULT_STREAK
    }

    const currentGen = streakGenerations.get(userId) ?? 0

    // 1. In-memory cache check
    if (!forceRefresh && memoryStreakCache && memoryStreakCache.userId === userId) {
      const isFresh = Date.now() - memoryStreakCache.timestamp < STREAK_CACHE_TTL
      if (isFresh) {
        return memoryStreakCache.streak
      }
      // SWR pattern: return stale streak immediately and revalidate in background
      this.revalidateStreakInBackground(userId)
      return memoryStreakCache.streak
    }

    // 2. In-flight request deduplication
    const inFlight = inFlightStreakRequests.get(userId)
    if (inFlight) {
      if (forceRefresh) {
        if (inFlight.isForced && inFlight.generation === currentGen) {
          return inFlight.promise
        }
      } else {
        return inFlight.promise
      }
    }

    // 3. Launch fetch with generation token tracking
    const requestGen = forceRefresh ? currentGen + 1 : currentGen
    if (forceRefresh) {
      streakGenerations.set(userId, requestGen)
      if (memoryStreakCache?.userId === userId) {
        memoryStreakCache = null
      }
    }

    const fetchPromise = (async () => {
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

          // STALE RESPONSE PROTECTION:
          const latestGen = streakGenerations.get(userId) ?? 0
          if (requestGen >= latestGen) {
            memoryStreakCache = {
              userId,
              streak,
              timestamp: Date.now(),
            }
          }
          return streak
        }
      } catch (err) {
        console.warn('StreakService.getUserStreak error:', err)
      } finally {
        if (inFlightStreakRequests.get(userId)?.generation === requestGen) {
          inFlightStreakRequests.delete(userId)
        }
      }

      return memoryStreakCache?.streak || DEFAULT_STREAK
    })()

    inFlightStreakRequests.set(userId, {
      promise: fetchPromise,
      generation: requestGen,
      isForced: forceRefresh,
    })
    return fetchPromise
  }

  /**
   * Background revalidation helper for SWR with stale protection
   */
  private static revalidateStreakInBackground(userId: string): void {
    if (inFlightStreakRequests.has(userId)) return

    const requestGen = streakGenerations.get(userId) ?? 0
    const tz = getClientTimezone()
    const task = (async (): Promise<UserStreak> => {
      try {
        const { data, error } = await supabase.rpc('get_user_streak', { p_timezone: tz })
        if (!error && data) {
          const streak: UserStreak = {
            currentStreak: Number(data.current_streak) || 0,
            longestStreak: Number(data.longest_streak) || 0,
            isActiveToday: Boolean(data.is_active_today),
            isAtRisk: Boolean(data.is_at_risk),
            lastActiveDate: data.last_active_date || null,
          }

          // STALE RESPONSE PROTECTION:
          const latestGen = streakGenerations.get(userId) ?? 0
          if (requestGen >= latestGen) {
            memoryStreakCache = {
              userId,
              streak,
              timestamp: Date.now(),
            }
          }
        }
      } catch {
        // Silent background failure
      } finally {
        if (inFlightStreakRequests.get(userId)?.generation === requestGen) {
          inFlightStreakRequests.delete(userId)
        }
      }
      return memoryStreakCache?.streak || DEFAULT_STREAK
    })()

    inFlightStreakRequests.set(userId, {
      promise: task,
      generation: requestGen,
      isForced: false,
    })
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

        // Update in-memory cache
        const updated: UserStreak = {
          currentStreak: streak,
          longestStreak,
          isActiveToday: true,
          isAtRisk: false,
          lastActiveDate: new Date().toISOString().split('T')[0],
        }
        memoryStreakCache = {
          userId,
          streak: updated,
          timestamp: Date.now(),
        }

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
