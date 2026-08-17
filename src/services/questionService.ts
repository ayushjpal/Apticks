import { supabase } from '../lib/supabase'
import { INITIAL_QUESTIONS } from '../data/questionsData'
import type {
  Question,
  UserQuestionProgress,
  QuestionBankStats,
} from '../types/questions'

const LOCAL_STORAGE_KEY_PREFIX = 'aptiverse_user_progress_'

export class QuestionService {
  /**
   * Get all questions with current user progress attached
   */
  static async getQuestionsWithProgress(userId?: string): Promise<{
    questions: Question[]
    progressMap: Record<string, UserQuestionProgress>
  }> {
    const questions = [...INITIAL_QUESTIONS]
    const progressMap: Record<string, UserQuestionProgress> = {}

    // 1. First load from LocalStorage cache for immediate instant rendering
    if (userId) {
      try {
        const localData = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`)
        if (localData) {
          const parsed = JSON.parse(localData) as Record<string, UserQuestionProgress>
          Object.assign(progressMap, parsed)
        }
      } catch (err) {
        console.warn('Could not read local progress cache:', err)
      }

      // 2. Fetch from Supabase Cloud if available
      try {
        const { data, error } = await supabase
          .from('user_question_progress')
          .select('*')
          .eq('user_id', userId)

        if (!error && data) {
          data.forEach((row: any) => {
            progressMap[row.question_id] = {
              questionId: row.question_id,
              isSolved: Boolean(row.is_solved),
              isCorrect: Boolean(row.is_correct),
              isBookmarked: Boolean(row.is_bookmarked),
              selectedOption: row.selected_option || undefined,
              attemptsCount: row.attempts_count || 1,
              timeSpentSeconds: row.time_spent_seconds || 0,
              lastAttemptedAt: row.last_attempted_at || new Date().toISOString(),
            }
          })

          // Update local cache with fresh Supabase state
          localStorage.setItem(
            `${LOCAL_STORAGE_KEY_PREFIX}${userId}`,
            JSON.stringify(progressMap)
          )
        }
      } catch (cloudErr) {
        console.warn('Supabase progress sync note (using local cache):', cloudErr)
      }
    }

    return { questions, progressMap }
  }

  /**
   * Submit an answer to a question, update local cache and sync to Supabase
   */
  static async submitAnswer(
    questionId: string,
    selectedOption: string,
    timeSpentSeconds: number,
    userId?: string
  ): Promise<{
    isCorrect: boolean
    correctOption: string
    progress: UserQuestionProgress
  }> {
    const question = INITIAL_QUESTIONS.find((q) => q.id === questionId)
    if (!question) {
      throw new Error(`Question ${questionId} not found`)
    }

    const isCorrect =
      selectedOption.trim().toUpperCase() ===
      question.correctOption.trim().toUpperCase()

    // Get current progress
    let existingProgress: UserQuestionProgress | undefined
    if (userId) {
      try {
        const local = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`)
        if (local) {
          const map = JSON.parse(local)
          existingProgress = map[questionId]
        }
      } catch {
        // ignore
      }
    }

    const updatedProgress: UserQuestionProgress = {
      questionId,
      isSolved: isCorrect || (existingProgress?.isSolved ?? false),
      isCorrect,
      isBookmarked: existingProgress?.isBookmarked ?? false,
      selectedOption,
      attemptsCount: (existingProgress?.attemptsCount ?? 0) + 1,
      timeSpentSeconds:
        (existingProgress?.timeSpentSeconds ?? 0) + timeSpentSeconds,
      lastAttemptedAt: new Date().toISOString(),
    }

    // Save to local cache
    if (userId) {
      try {
        const localKey = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`
        const currentMap = JSON.parse(localStorage.getItem(localKey) || '{}')
        currentMap[questionId] = updatedProgress
        localStorage.setItem(localKey, JSON.stringify(currentMap))
      } catch (err) {
        console.warn('Failed to update local progress storage:', err)
      }

      // Sync with Supabase (fire and forget / background sync)
      ;(async () => {
        try {
          const { error } = await supabase
            .from('user_question_progress')
            .upsert(
              {
                user_id: userId,
                question_id: questionId,
                selected_option: selectedOption,
                is_solved: updatedProgress.isSolved,
                is_correct: isCorrect,
                is_bookmarked: updatedProgress.isBookmarked,
                attempts_count: updatedProgress.attemptsCount,
                time_spent_seconds: updatedProgress.timeSpentSeconds,
                last_attempted_at: updatedProgress.lastAttemptedAt,
              },
              { onConflict: 'user_id,question_id' }
            )
          if (error) {
            console.warn('Supabase upsert progress note:', error.message)
          }
        } catch (e) {
          console.warn('Supabase network issue:', e)
        }
      })()
    }

    return {
      isCorrect,
      correctOption: question.correctOption,
      progress: updatedProgress,
    }
  }

  /**
   * Toggle bookmark status for a question
   */
  static async toggleBookmark(
    questionId: string,
    userId?: string
  ): Promise<boolean> {
    let newStatus = true

    if (userId) {
      const localKey = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`
      let currentMap: Record<string, UserQuestionProgress> = {}
      try {
        currentMap = JSON.parse(localStorage.getItem(localKey) || '{}')
      } catch {
        currentMap = {}
      }

      const existing = currentMap[questionId]
      newStatus = !(existing?.isBookmarked ?? false)

      const updated: UserQuestionProgress = {
        questionId,
        isSolved: existing?.isSolved ?? false,
        isCorrect: existing?.isCorrect ?? false,
        isBookmarked: newStatus,
        selectedOption: existing?.selectedOption,
        attemptsCount: existing?.attemptsCount ?? 0,
        timeSpentSeconds: existing?.timeSpentSeconds ?? 0,
        lastAttemptedAt: existing?.lastAttemptedAt ?? new Date().toISOString(),
      }

      currentMap[questionId] = updated
      localStorage.setItem(localKey, JSON.stringify(currentMap))

      // Sync to Supabase
      ;(async () => {
        try {
          const { error } = await supabase
            .from('user_question_progress')
            .upsert(
              {
                user_id: userId,
                question_id: questionId,
                is_bookmarked: newStatus,
                is_solved: updated.isSolved,
                is_correct: updated.isCorrect,
                attempts_count: updated.attemptsCount,
                time_spent_seconds: updated.timeSpentSeconds,
                last_attempted_at: updated.lastAttemptedAt,
              },
              { onConflict: 'user_id,question_id' }
            )
          if (error) {
            console.warn('Supabase bookmark sync note:', error.message)
          }
        } catch (e) {
          console.warn('Supabase sync bookmark error:', e)
        }
      })()
    }

    return newStatus
  }

  /**
   * Calculate summary statistics for question bank and user progress
   */
  static calculateStats(
    questions: Question[],
    progressMap: Record<string, UserQuestionProgress>
  ): QuestionBankStats {
    let solvedCount = 0
    let easySolved = 0
    let easyTotal = 0
    let mediumSolved = 0
    let mediumTotal = 0
    let hardSolved = 0
    let hardTotal = 0
    let bookmarkedCount = 0
    let totalPoints = 0
    let totalAttempts = 0
    let correctAttempts = 0

    questions.forEach((q) => {
      const prog = progressMap[q.id]
      const isSolved = prog?.isSolved ?? false

      if (q.difficulty === 'easy') {
        easyTotal++
        if (isSolved) easySolved++
      } else if (q.difficulty === 'medium') {
        mediumTotal++
        if (isSolved) mediumSolved++
      } else if (q.difficulty === 'hard') {
        hardTotal++
        if (isSolved) hardSolved++
      }

      if (isSolved) {
        solvedCount++
        totalPoints += q.points
      }

      if (prog?.isBookmarked) {
        bookmarkedCount++
      }

      if (prog) {
        totalAttempts += prog.attemptsCount
        if (prog.isCorrect) {
          correctAttempts++
        }
      }
    })

    const accuracyRate =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0

    return {
      totalQuestions: questions.length,
      solvedCount,
      easySolved,
      easyTotal,
      mediumSolved,
      mediumTotal,
      hardSolved,
      hardTotal,
      bookmarkedCount,
      accuracyRate,
      totalPoints,
    }
  }
}
