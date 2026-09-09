import { supabase } from '../lib/supabase'
import { ContestService } from './contestService'
import { getLevelTierTitle, type LevelTierTitle } from '../utils/levelEngine'
import type {
  GlobalLeaderboardEntry,
  GlobalLeaderboardResponse,
  UserGlobalRankResult,
} from '../types/leaderboard'
import type { Contest, ContestLeaderboardEntry } from '../types/contests'

export class LeaderboardService {
  /**
   * Fetch paginated Global Arena Leaderboard
   * Deterministic server-side ranking via get_global_leaderboard RPC
   */
  static async getGlobalLeaderboard(
    limit = 50,
    offset = 0
  ): Promise<GlobalLeaderboardResponse> {
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

      return {
        success: Boolean(data?.success),
        totalCount: Number(data?.total_count) || entries.length,
        limit: Number(data?.limit) || limit,
        offset: Number(data?.offset) || offset,
        leaderboard: entries,
      }
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
    }
  }

  /**
   * Fetch current user's global standing, percentile, and complete level progression
   * Shows user position even when outside current page
   */
  static async getUserGlobalRank(userId: string): Promise<UserGlobalRankResult> {
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

      return {
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
    } catch (err) {
      console.warn('LeaderboardService.getUserGlobalRank note:', err)
      return { found: false }
    }
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
