import { supabase } from '../lib/supabase'
import type {
  UserBadgesResponse,
  EvaluateBadgesResponse,
  BadgeWithProgress,
  BadgeCategory,
  BadgeTier,
  BadgeCriteriaType,
} from '../types/gamification'

export class GamificationService {
  /**
   * Fetch complete badge catalog with user's unlock state and server-calculated progress.
   */
  static async getUserBadges(userId: string): Promise<UserBadgesResponse> {
    try {
      const { data, error } = await supabase.rpc('get_user_badges', {
        p_user_id: userId,
      })

      if (error) {
        console.error('Error fetching user badges:', error)
        return {
          success: false,
          userId,
          unlockedCount: 0,
          totalCount: 0,
          badges: [],
          error: error.message,
        }
      }

      const badges: BadgeWithProgress[] = (data?.badges || []).map(
        (b: {
          id: string
          title: string
          description: string
          category: string
          tier: string
          icon: string
          criteria_type: string
          criteria_threshold: number
          xp_reward: number
          is_unlocked: boolean
          unlocked_at: string | null
          current_progress: number
          progress_percentage: number
        }) => ({
          id: String(b.id),
          title: String(b.title),
          description: String(b.description),
          category: b.category as BadgeCategory,
          tier: b.tier as BadgeTier,
          icon: String(b.icon),
          criteriaType: b.criteria_type as BadgeCriteriaType,
          criteriaThreshold: Number(b.criteria_threshold) || 0,
          xpReward: Number(b.xp_reward) || 0,
          isUnlocked: Boolean(b.is_unlocked),
          unlockedAt: b.unlocked_at || null,
          currentProgress: Number(b.current_progress) || 0,
          progressPercentage: Number(b.progress_percentage) || 0,
        })
      )

      return {
        success: Boolean(data?.success),
        userId: String(data?.user_id || userId),
        unlockedCount: Number(data?.unlocked_count) || 0,
        totalCount: Number(data?.total_count) || badges.length,
        badges,
      }
    } catch (err) {
      console.error('GamificationService.getUserBadges exception:', err)
      return {
        success: false,
        userId,
        unlockedCount: 0,
        totalCount: 0,
        badges: [],
        error: err instanceof Error ? err.message : 'Failed to load badges.',
      }
    }
  }

  /**
   * Evaluate authoritative eligibility for the current session user.
   * Safe, idempotent, server-derived.
   */
  static async evaluateUserBadges(): Promise<EvaluateBadgesResponse> {
    try {
      const { data, error } = await supabase.rpc('evaluate_user_badges')

      if (error) {
        console.warn('GamificationService.evaluateUserBadges note:', error)
        return {
          success: false,
          newlyUnlockedCount: 0,
          totalUnlocked: 0,
          error: error.message,
        }
      }

      return {
        success: Boolean(data?.success),
        userId: data?.user_id,
        newlyUnlocked: Array.isArray(data?.newly_unlocked) ? data.newly_unlocked : [],
        newlyUnlockedCount: Number(data?.newly_unlocked_count) || 0,
        totalUnlocked: Number(data?.total_unlocked) || 0,
      }
    } catch (err) {
      console.warn('GamificationService.evaluateUserBadges exception:', err)
      return {
        success: false,
        newlyUnlockedCount: 0,
        totalUnlocked: 0,
        error: err instanceof Error ? err.message : 'Evaluation failed.',
      }
    }
  }
}
