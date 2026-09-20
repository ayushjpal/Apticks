import { supabase } from '../lib/supabase'
import { ContestService } from './contestService'
import { getLevelTierTitle, type LevelTierTitle } from '../utils/levelEngine'
import type {
  GlobalLeaderboardEntry,
  GlobalLeaderboardResponse,
  UserGlobalRankResult,
} from '../types/leaderboard'
import type { Contest, ContestLeaderboardEntry } from '../types/contests'

interface CachedLeaderboard {
  data: GlobalLeaderboardResponse
  timestamp: number
}

interface CachedUserRank {
  data: UserGlobalRankResult
  timestamp: number
}

const leaderboardCache = new Map<string, CachedLeaderboard>()
const inFlightLeaderboardPromises = new Map<string, Promise<GlobalLeaderboardResponse>>()
const LEADERBOARD_CACHE_TTL = 45 * 1000 // 45 seconds

interface InFlightUserRank {
  promise: Promise<UserGlobalRankResult>
  generation: number
  isForced: boolean
}

const userRankCache = new Map<string, CachedUserRank>()
const inFlightUserRankRequests = new Map<string, InFlightUserRank>()
const userRankGenerations = new Map<string, number>()
const USER_RANK_CACHE_TTL = 45 * 1000 // 45 seconds

export class LeaderboardService {
  /**
   * Clear leaderboard cache
   */
  static invalidateLeaderboard(): void {
    leaderboardCache.clear()
  }

  /**
   * Clear user rank cache with generation increment for stale protection
   */
  static invalidateUserRank(userId?: string): void {
    if (userId) {
      userRankCache.delete(userId)
      const nextGen = (userRankGenerations.get(userId) ?? 0) + 1
      userRankGenerations.set(userId, nextGen)
      inFlightUserRankRequests.delete(userId)
    } else {
      userRankCache.clear()
      userRankGenerations.clear()
      inFlightUserRankRequests.clear()
    }
  }

  /**
   * Fetch paginated Global Arena Leaderboard
   * Deterministic server-side ranking via get_global_leaderboard RPC
   * Implements in-memory SWR caching and in-flight request deduplication.
   */
  static async getGlobalLeaderboard(
    limit = 50,
    offset = 0,
    forceRefresh = false
  ): Promise<GlobalLeaderboardResponse> {
    const key = `${limit}_${offset}`

    // 1. Cache hit check
    if (!forceRefresh) {
      const cached = leaderboardCache.get(key)
      if (cached) {
        const isFresh = Date.now() - cached.timestamp < LEADERBOARD_CACHE_TTL
        if (isFresh) {
          return cached.data
        }
        // SWR: return stale data immediately, revalidate in background
        this.revalidateGlobalLeaderboardInBackground(limit, offset, key)
        return cached.data
      }
    }

    // 2. In-flight request deduplication
    const inFlight = inFlightLeaderboardPromises.get(key)
    if (inFlight) {
      return inFlight
    }

    // 3. Launch fetch with in-flight tracking
    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase.rpc('get_global_leaderboard', {
          p_limit: limit,
          p_offset: offset,
        })

        if (error) {
          console.error('Error fetching global leaderboard:', error)
          return {
            success: false,
            totalCount: 0,
            limit,
            offset,
            leaderboard: [],
            error: error.message,
          }
        }

        const entries: GlobalLeaderboardEntry[] = (data?.leaderboard || []).map(
          (row: {
            rank: number
            user_id: string
            username: string
            display_name: string
            avatar_url: string | null
            total_xp: number
            solved_count: number
            accuracy_percentage: number
            contests_count: number
            level: number
            level_title?: string
          }) => {
            const lvl = Number(row.level) || 1
            return {
              rank: Number(row.rank),
              userId: String(row.user_id),
              username: String(row.username || 'player'),
              displayName: String(row.display_name || row.username || 'Player'),
              avatarUrl: row.avatar_url || null,
              totalXp: Number(row.total_xp) || 0,
              solvedCount: Number(row.solved_count) || 0,
              accuracyPercentage: Number(row.accuracy_percentage) || 0,
              contestsCount: Number(row.contests_count) || 0,
              level: lvl,
              levelTitle: (row.level_title as LevelTierTitle) || getLevelTierTitle(lvl),
            }
          }
        )

        const result: GlobalLeaderboardResponse = {
          success: Boolean(data?.success),
          totalCount: Number(data?.total_count) || entries.length,
          limit: Number(data?.limit) || limit,
          offset: Number(data?.offset) || offset,
          leaderboard: entries,
        }

        leaderboardCache.set(key, { data: result, timestamp: Date.now() })
        return result
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Network error loading global leaderboard.'
        console.error('LeaderboardService.getGlobalLeaderboard exception:', err)
        return {
          success: false,
          totalCount: 0,
          limit,
          offset,
          leaderboard: [],
          error: message,
        }
      } finally {
        inFlightLeaderboardPromises.delete(key)
      }
    })()

    inFlightLeaderboardPromises.set(key, fetchPromise)
    return fetchPromise
  }

  /**
   * Background revalidation for SWR
   */
  private static revalidateGlobalLeaderboardInBackground(
    limit: number,
    offset: number,
    key: string
  ): void {
    if (inFlightLeaderboardPromises.has(key)) return

    const revalPromise = (async () => {
      try {
        const { data, error } = await supabase.rpc('get_global_leaderboard', {
          p_limit: limit,
          p_offset: offset,
        })
        if (!error && data) {
          const entries: GlobalLeaderboardEntry[] = (data?.leaderboard || []).map(
            (row: {
              rank: number
              user_id: string
              username: string
              display_name: string
              avatar_url: string | null
              total_xp: number
              solved_count: number
              accuracy_percentage: number
              contests_count: number
              level: number
              level_title?: string
            }) => {
              const lvl = Number(row.level) || 1
              return {
                rank: Number(row.rank),
                userId: String(row.user_id),
                username: String(row.username || 'player'),
                displayName: String(row.display_name || row.username || 'Player'),
                avatarUrl: row.avatar_url || null,
                totalXp: Number(row.total_xp) || 0,
                solvedCount: Number(row.solved_count) || 0,
                accuracyPercentage: Number(row.accuracy_percentage) || 0,
                contestsCount: Number(row.contests_count) || 0,
                level: lvl,
                levelTitle: (row.level_title as LevelTierTitle) || getLevelTierTitle(lvl),
              }
            }
          )
          leaderboardCache.set(key, {
            data: {
              success: Boolean(data?.success),
              totalCount: Number(data?.total_count) || entries.length,
              limit: Number(data?.limit) || limit,
              offset: Number(data?.offset) || offset,
              leaderboard: entries,
            },
            timestamp: Date.now(),
          })
        }
      } catch {
        // silent background failure
      } finally {
        inFlightLeaderboardPromises.delete(key)
      }
      return (
        leaderboardCache.get(key)?.data || {
          success: false,
          leaderboard: [],
          totalCount: 0,
          limit,
          offset,
        }
      )
    })()

    inFlightLeaderboardPromises.set(key, revalPromise)
  }

  /**
   * Fetch current user's global standing, percentile, and complete level progression
   * Shows user position even when outside current page
   * Implements in-memory SWR caching and in-flight request deduplication.
   */
  static async getUserGlobalRank(
    userId: string,
    forceRefresh = false
  ): Promise<UserGlobalRankResult> {
    if (!userId) return { found: false }

    const currentGen = userRankGenerations.get(userId) ?? 0

    // 1. Cache hit check
    if (!forceRefresh) {
      const cached = userRankCache.get(userId)
      if (cached) {
        const isFresh = Date.now() - cached.timestamp < USER_RANK_CACHE_TTL
        if (isFresh) {
          return cached.data
        }
        // SWR: return stale data immediately, revalidate in background
        this.revalidateUserRankInBackground(userId)
        return cached.data
      }
    }

    // 2. In-flight request deduplication
    const inFlight = inFlightUserRankRequests.get(userId)
    if (inFlight) {
      if (forceRefresh) {
        // If an in-flight request is already forced and matches the current generation, reuse it!
        if (inFlight.isForced && inFlight.generation === currentGen) {
          return inFlight.promise
        }
        // Otherwise an older or unforced fetch is in-flight: bypass it with a new generation below
      } else {
        // Unforced call can reuse any running fetch for this user
        return inFlight.promise
      }
    }

    // 3. Launch fetch with generation token tracking
    const requestGen = forceRefresh ? currentGen + 1 : currentGen
    if (forceRefresh) {
      userRankGenerations.set(userId, requestGen)
      userRankCache.delete(userId)
    }

    const fetchPromise = (async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_global_rank', {
          p_user_id: userId,
        })

        if (error || !data?.success) {
          return { found: false }
        }

        const lvl = Number(data.level) || 1
        const title = (data.level_title as LevelTierTitle) || getLevelTierTitle(lvl)
        const totalXp = Number(data.total_xp) || 0
        const currentLevelXp =
          typeof data.current_level_xp === 'number'
            ? data.current_level_xp
            : 25 * (lvl - 1) * (lvl + 2)
        const nextLevelXp =
          typeof data.next_level_xp === 'number'
            ? data.next_level_xp
            : 25 * lvl * (lvl + 3)
        const xpInLevel =
          typeof data.xp_in_level === 'number'
            ? data.xp_in_level
            : Math.max(0, totalXp - currentLevelXp)
        const xpRequired =
          typeof data.xp_required === 'number'
            ? data.xp_required
            : Math.max(0, nextLevelXp - totalXp)
        const progressPercentage =
          typeof data.progress_percentage === 'number'
            ? data.progress_percentage
            : nextLevelXp > currentLevelXp
            ? Math.min(
                100,
                Math.round((xpInLevel / (nextLevelXp - currentLevelXp)) * 1000) / 10
              )
            : 0

        const result: UserGlobalRankResult = {
          found: true,
          rank: Number(data.rank),
          userId: String(data.user_id),
          username: String(data.username),
          displayName: String(data.display_name),
          avatarUrl: data.avatar_url || null,
          totalXp,
          solvedCount: Number(data.solved_count) || 0,
          accuracyPercentage: Number(data.accuracy_percentage) || 0,
          contestsCount: Number(data.contests_count) || 0,
          level: lvl,
          levelTitle: title,
          currentLevelXp,
          nextLevelXp,
          xpInLevel,
          xpRequired,
          progressPercentage,
          levelProgress: {
            level: lvl,
            title,
            totalXp,
            currentLevelXp,
            nextLevelXp,
            xpInLevel,
            xpRequired,
            progressPercentage,
          },
          totalCompetitors: Number(data.total_competitors) || 0,
        }

        // STALE RESPONSE PROTECTION:
        // Only update cache if this request's generation is >= the latest generation for this user
        const latestGen = userRankGenerations.get(userId) ?? 0
        if (requestGen >= latestGen) {
          userRankCache.set(userId, { data: result, timestamp: Date.now() })
        }

        return result
      } catch (err) {
        console.warn('LeaderboardService.getUserGlobalRank note:', err)
        return { found: false }
      } finally {
        if (inFlightUserRankRequests.get(userId)?.generation === requestGen) {
          inFlightUserRankRequests.delete(userId)
        }
      }
    })()

    inFlightUserRankRequests.set(userId, {
      promise: fetchPromise,
      generation: requestGen,
      isForced: forceRefresh,
    })
    return fetchPromise
  }

  /**
   * Background revalidation for User Rank with stale protection
   */
  private static revalidateUserRankInBackground(userId: string): void {
    if (inFlightUserRankRequests.has(userId)) return

    const requestGen = userRankGenerations.get(userId) ?? 0

    const revalPromise = (async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_global_rank', {
          p_user_id: userId,
        })
        if (!error && data?.success) {
          const lvl = Number(data.level) || 1
          const title = (data.level_title as LevelTierTitle) || getLevelTierTitle(lvl)
          const totalXp = Number(data.total_xp) || 0
          const currentLevelXp =
            typeof data.current_level_xp === 'number'
              ? data.current_level_xp
              : 25 * (lvl - 1) * (lvl + 2)
          const nextLevelXp =
            typeof data.next_level_xp === 'number'
              ? data.next_level_xp
              : 25 * lvl * (lvl + 3)
          const xpInLevel =
            typeof data.xp_in_level === 'number'
              ? data.xp_in_level
              : Math.max(0, totalXp - currentLevelXp)
          const xpRequired =
            typeof data.xp_required === 'number'
              ? data.xp_required
              : Math.max(0, nextLevelXp - totalXp)
          const progressPercentage =
            typeof data.progress_percentage === 'number'
              ? data.progress_percentage
              : nextLevelXp > currentLevelXp
              ? Math.min(
                  100,
                  Math.round((xpInLevel / (nextLevelXp - currentLevelXp)) * 1000) / 10
                )
              : 0

          const result: UserGlobalRankResult = {
            found: true,
            rank: Number(data.rank),
            userId: String(data.user_id),
            username: String(data.username),
            displayName: String(data.display_name),
            avatarUrl: data.avatar_url || null,
            totalXp,
            solvedCount: Number(data.solved_count) || 0,
            accuracyPercentage: Number(data.accuracy_percentage) || 0,
            contestsCount: Number(data.contests_count) || 0,
            level: lvl,
            levelTitle: title,
            currentLevelXp,
            nextLevelXp,
            xpInLevel,
            xpRequired,
            progressPercentage,
            levelProgress: {
              level: lvl,
              title,
              totalXp,
              currentLevelXp,
              nextLevelXp,
              xpInLevel,
              xpRequired,
              progressPercentage,
            },
            totalCompetitors: Number(data.total_competitors) || 0,
          }

          // STALE RESPONSE PROTECTION:
          const latestGen = userRankGenerations.get(userId) ?? 0
          if (requestGen >= latestGen) {
            userRankCache.set(userId, {
              data: result,
              timestamp: Date.now(),
            })
          }
        }
      } catch {
        // silent background failure
      } finally {
        if (inFlightUserRankRequests.get(userId)?.generation === requestGen) {
          inFlightUserRankRequests.delete(userId)
        }
      }
      return userRankCache.get(userId)?.data || { found: false }
    })()

    inFlightUserRankRequests.set(userId, {
      promise: revalPromise,
      generation: requestGen,
      isForced: false,
    })
  }

  /**
   * Fetch contest leaderboard using existing trusted Contest Engine
   */
  static async getContestLeaderboard(contestId: string): Promise<ContestLeaderboardEntry[]> {
    return ContestService.getContestLeaderboard(contestId)
  }

  /**
   * Fetch available contests for tournament leaderboard selector
   * Prioritizes completed and active contests
   */
  static async getContestsForLeaderboard(): Promise<Contest[]> {
    try {
      const contests = await ContestService.getContests()
      // Order: completed first, then live, then upcoming
      return contests.sort((a, b) => {
        const order: Record<string, number> = { completed: 1, live: 2, upcoming: 3 }
        const rankA = order[a.status] ?? 4
        const rankB = order[b.status] ?? 4
        if (rankA !== rankB) return rankA - rankB
        return new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      })
    } catch (err) {
      console.error('Error fetching contests for leaderboard:', err)
      return []
    }
  }
}
