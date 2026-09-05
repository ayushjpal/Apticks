import { supabase } from '../lib/supabase'
import { QuestionService } from './questionService'
import type {
  DailyChallenge,
  DailyChallengeSubmissionResult,
} from '../types/questions'

const CHALLENGE_CACHE_PREFIX = 'apticks_daily_challenge_'
let isSubmissionInFlight = false

function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export class ChallengeService {
  /**
   * Fetches the active Daily Challenge for the user's current calendar day.
   * Strips correct_option before submission to prevent client answer leaks.
   */
  static async getDailyChallenge(): Promise<DailyChallenge | null> {
    try {
      const tz = getClientTimezone()
      const { data, error } = await supabase.rpc('get_daily_challenge', {
        p_timezone: tz,
      })

      if (!error && data && data.found && data.question) {
        const questionObj = QuestionService.mapRowToQuestion(data.question)

        const challenge: DailyChallenge = {
          challengeId: String(data.challenge_id),
          challengeDate: String(data.challenge_date),
          bonusXp: Number(data.bonus_xp) || 50,
          isCompleted: Boolean(data.is_completed),
          bonusXpAwarded: data.bonus_xp_awarded ? Number(data.bonus_xp_awarded) : undefined,
          completedAt: data.completed_at ? String(data.completed_at) : null,
          secondsLeft: Number(data.seconds_left) || 0,
          question: questionObj,
        }

        // Cache state locally
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          localStorage.setItem(
            `${CHALLENGE_CACHE_PREFIX}${challenge.challengeDate}`,
            JSON.stringify(challenge)
          )
        }

        return challenge
      }
    } catch (err) {
      console.warn('ChallengeService.getDailyChallenge error:', err)
    }

    return null
  }

  /**
   * Submits an answer to the Daily Challenge via the authoritative PostgreSQL RPC.
   * Enforces in-flight locking, concurrency protection, server-side answer verification,
   * single reward award (+50 XP), and atomic streak progression.
   */
  static async submitDailyChallenge(
    challengeId: string,
    selectedOption: string,
    timeSpentSeconds: number
  ): Promise<DailyChallengeSubmissionResult> {
    if (isSubmissionInFlight) {
      return {
        success: false,
        isCorrect: false,
        bonusXp: 0,
        alreadyCompleted: false,
        message: 'Submission already processing. Please wait.',
      }
    }

    isSubmissionInFlight = true

    try {
      const tz = getClientTimezone()
      const { data, error } = await supabase.rpc('submit_daily_challenge', {
        p_challenge_id: challengeId,
        p_selected_option: selectedOption.trim().toUpperCase(),
        p_time_spent_seconds: timeSpentSeconds,
        p_timezone: tz,
      })

      if (error) {
        console.error('Challenge submission RPC error:', error)
        return {
          success: false,
          isCorrect: false,
          bonusXp: 0,
          alreadyCompleted: false,
          message: error.message || 'Error submitting challenge',
          error: error.message,
        }
      }

      const result: DailyChallengeSubmissionResult = {
        success: Boolean(data?.success),
        isCorrect: Boolean(data?.is_correct),
        correctOption: data?.correct_option ? String(data.correct_option) : undefined,
        explanation: data?.explanation ? String(data.explanation) : undefined,
        bonusXp: Number(data?.bonus_xp) || 0,
        questionXp: data?.question_xp !== undefined ? Number(data.question_xp) : undefined,
        xpChange: data?.xp_change !== undefined ? Number(data.xp_change) : undefined,
        alreadyCompleted: Boolean(data?.already_completed),
        streak: data?.streak !== undefined ? Number(data.streak) : undefined,
        longestStreak: data?.longest_streak !== undefined ? Number(data.longest_streak) : undefined,
        message: data?.message ? String(data.message) : '',
      }

      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error during challenge submission.'
      return {
        success: false,
        isCorrect: false,
        bonusXp: 0,
        alreadyCompleted: false,
        message: msg,
        error: msg,
      }
    } finally {
      isSubmissionInFlight = false
    }
  }
}
