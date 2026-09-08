import { supabase } from '../lib/supabase'
import { ContestService } from './contestService'
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
        }) => ({
          rank: Number(row.rank),
          userId: String(row.user_id),
          username: String(row.username || 'player'),
          displayName: String(row.display_name || row.username || 'Player'),
          avatarUrl: row.avatar_url || null,
          totalXp: Number(row.total_xp) || 0,
          solvedCount: Number(row.solved_count) || 0,
          accuracyPercentage: Number(row.accuracy_percentage) || 0,
          contestsCount: Number(row.contests_count) || 0,
          level: Number(row.level) || 1,
        })
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
   * Fetch current user's global standing and percentile
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

      return {
        found: true,
        rank: Number(data.rank),
        userId: String(data.user_id),
        username: String(data.username),
        displayName: String(data.display_name),
        avatarUrl: data.avatar_url || null,
        totalXp: Number(data.total_xp) || 0,
        solvedCount: Number(data.solved_count) || 0,
        accuracyPercentage: Number(data.accuracy_percentage) || 0,
        contestsCount: Number(data.contests_count) || 0,
        level: Number(data.level) || 1,
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
