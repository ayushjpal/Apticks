export type BadgeCategory =
  | 'practice'
  | 'streak'
  | 'xp'
  | 'accuracy'
  | 'contest'
  | 'special'

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export type BadgeCriteriaType =
  | 'solved_count'
  | 'streak_days'
  | 'total_xp'
  | 'accuracy_percentage'
  | 'contests_count'
  | 'special'

export interface Badge {
  id: string
  title: string
  description: string
  category: BadgeCategory
  tier: BadgeTier
  icon: string
  criteriaType: BadgeCriteriaType
  criteriaThreshold: number
  xpReward: number
  isActive: boolean
  createdAt?: string
}

export interface UserBadge {
  id: string
  userId: string
  badgeId: string
  unlockedAt: string
}

export interface BadgeWithProgress {
  id: string
  title: string
  description: string
  category: BadgeCategory
  tier: BadgeTier
  icon: string
  criteriaType: BadgeCriteriaType
  criteriaThreshold: number
  xpReward: number
  isUnlocked: boolean
  unlockedAt: string | null
  currentProgress: number
  progressPercentage: number
}

export interface UserBadgesResponse {
  success: boolean
  userId: string
  unlockedCount: number
  totalCount: number
  badges: BadgeWithProgress[]
  error?: string
}

export interface EvaluateBadgesResponse {
  success: boolean
  userId?: string
  newlyUnlocked?: string[]
  newlyUnlockedCount: number
  totalUnlocked: number
  error?: string
}
