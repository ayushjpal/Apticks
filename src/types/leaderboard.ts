export interface GlobalLeaderboardEntry {
  rank: number
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  totalXp: number
  solvedCount: number
  accuracyPercentage: number
  contestsCount: number
  level: number
}

export interface UserGlobalRankResult {
  found: boolean
  rank?: number
  userId?: string
  username?: string
  displayName?: string
  avatarUrl?: string | null
  totalXp?: number
  solvedCount?: number
  accuracyPercentage?: number
  contestsCount?: number
  level?: number
  totalCompetitors?: number
}

export interface GlobalLeaderboardResponse {
  success: boolean
  totalCount: number
  limit: number
  offset: number
  leaderboard: GlobalLeaderboardEntry[]
  error?: string
}

export type LeaderboardViewMode = 'global' | 'contest'
