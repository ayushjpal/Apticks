import { supabase } from '../lib/supabase'
import { INITIAL_QUESTIONS } from '../data/questionsData'
import { StreakService } from './streakService'
import { LeaderboardService } from './leaderboardService'
import type { UserGlobalRankResult } from '../types/leaderboard'
import type {
  Question,
  Category,
  Difficulty,
  QuestionOption,
  UserQuestionProgress,
  UserQuestionAttempt,
  QuestionBankStats,
  QuestionFilters,
  DatabaseQuestion,
} from '../types/questions'

const LOCAL_STORAGE_KEY_PREFIX = 'aptiverse_user_progress_'
const LOCAL_ATTEMPTS_KEY_PREFIX = 'aptiverse_user_attempts_'

const inMemoryCache: Record<string, string> = {}

/**
 * Safe localStorage reader (resilient to SSR, Node.js, and private browsing)
 */
function getStoredItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key)
    }
  } catch {
    // ignore
  }
  return inMemoryCache[key] ?? null
}

/**
 * Safe localStorage writer (resilient to SSR, Node.js, and private browsing)
 */
function setStoredItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value)
    }
  } catch {
    // ignore
  }
  inMemoryCache[key] = value
}

/**
 * Helper to normalize category strings from database or user inputs
 */
function normalizeCategory(category: string): Category {
  const c = category.trim().toLowerCase()
  if (c.includes('quant')) return 'Quantitative Aptitude'
  if (c.includes('logic')) return 'Logical Reasoning'
  if (c.includes('data')) return 'Data Interpretation'
  if (c.includes('verbal')) return 'Verbal & Abstract'
  return 'Quantitative Aptitude'
}

/**
 * Helper to normalize difficulty strings
 */
function normalizeDifficulty(difficulty: string): Difficulty {
  const d = difficulty.trim().toLowerCase()
  if (d === 'hard') return 'hard'
  if (d === 'medium') return 'medium'
  return 'easy'
}

/**
 * Helper to parse JSON or array fields safely
 */
function safeParseArray<T>(val: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(val)) return val as T[]
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      if (Array.isArray(parsed)) return parsed as T[]
    } catch {
      // fallback
    }
  }
  return fallback
}

export class QuestionService {
  /**
   * Centralized Deterministic Competitive XP Calculation Engine
   * Rules:
   * 1. First Correct Solve: +question.points (e.g. +10, +15, +20 XP)
   * 2. Correct Reattempt (Already Solved): +0 XP (records attempt without farming duplicate XP)
   * 3. Incorrect Attempt / Reattempt: -25% of question.points (e.g. -3, -4, -5 XP)
   */
  static calculateXPChange(
    points: number,
    isCorrect: boolean,
    wasAlreadySolved: boolean
  ): { xpChange: number; reason: string } {
    const penalty = Math.max(1, Math.round(points * 0.25))

    if (isCorrect) {
      if (!wasAlreadySolved) {
        return {
          xpChange: points,
          reason: `First correct solve (+${points} XP)`,
        }
      } else {
        return {
          xpChange: 0,
          reason: `Reattempt already solved (+0 XP)`,
        }
      }
    } else {
      return {
        xpChange: -penalty,
        reason: `Incorrect answer penalty (-${penalty} XP)`,
      }
    }
  }

  /**
   * Sorts questions into an intelligent Unsolved-First Question Queue:
   * Priority 1: Unsolved & Bookmarked questions
   * Priority 2: Unsolved questions
   * Priority 3: Previously solved questions
   * Within each partition, preserves natural question ID ordering.
   */
  static sortQuestionsForUser(
    questions: Question[],
    progressMap: Record<string, UserQuestionProgress>
  ): Question[] {
    const bookmarkedUnsolved: Question[] = []
    const otherUnsolved: Question[] = []
    const solved: Question[] = []

    questions.forEach((q) => {
      const prog = progressMap[q.id]
      const isSolved = prog?.isSolved ?? false
      const isBookmarked = prog?.isBookmarked ?? false

      if (isSolved) {
        solved.push(q)
      } else if (isBookmarked) {
        bookmarkedUnsolved.push(q)
      } else {
        otherUnsolved.push(q)
      }
    })

    return [...bookmarkedUnsolved, ...otherUnsolved, ...solved]
  }

  /**
   * Maps a raw Supabase database row into a frontend Question object
   */
  static mapRowToQuestion(row: DatabaseQuestion | Record<string, unknown>): Question {
    const rawOptions = safeParseArray<QuestionOption>(row.options, [])
    const hints = safeParseArray<string>(row.hints, [])
    const tags = safeParseArray<string>(row.tags, [])

    return {
      id: String(row.id),
      title: String(row.title || ''),
      prompt: String(row.prompt || ''),
      category: normalizeCategory(String(row.category || '')),
      topic: String(row.topic || ''),
      difficulty: normalizeDifficulty(String(row.difficulty || 'easy')),
      options: rawOptions.length > 0 ? rawOptions : [
        { id: 'A', text: 'Option A' },
        { id: 'B', text: 'Option B' },
        { id: 'C', text: 'Option C' },
        { id: 'D', text: 'Option D' },
      ],
      correctOption: String(row.correct_option || 'A').trim().toUpperCase(),
      explanation: String(row.explanation || ''),
      formulaOrRule: row.formula_or_rule ? String(row.formula_or_rule) : undefined,
      hints,
      points: Number(row.points) || 10,
      acceptanceRate: typeof row.acceptance_rate === 'number' ? row.acceptance_rate : undefined,
      tags,
    }
  }

  /**
   * Fetch questions directly from Supabase (with fallback to local dataset if offline/empty)
   */
  static async getQuestions(
    filters?: Partial<QuestionFilters>,
    options?: { limit?: number; offset?: number }
  ): Promise<Question[]> {
    try {
      let query = supabase
        .from('questions')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true })

      if (filters?.category && filters.category !== 'all') {
        query = query.eq('category', filters.category)
      }

      if (filters?.difficulty && filters.difficulty !== 'all') {
        query = query.eq('difficulty', filters.difficulty.toLowerCase())
      }

      if (filters?.topic && filters.topic !== 'all') {
        query = query.ilike('topic', filters.topic)
      }

      if (typeof options?.limit === 'number') {
        const offset = options.offset || 0
        query = query.range(offset, offset + options.limit - 1)
      }

      const { data, error } = await query

      if (!error && data && data.length > 0) {
        return data.map((row: Record<string, unknown>) =>
          this.mapRowToQuestion(row as unknown as DatabaseQuestion)
        )
      }
    } catch (err) {
      console.warn('Supabase questions fetch note (using fallback):', err)
    }

    // Fallback to local INITIAL_QUESTIONS if database is empty/unreachable
    let fallback = [...INITIAL_QUESTIONS]
    if (filters?.category && filters.category !== 'all') {
      fallback = fallback.filter((q) => q.category === filters.category)
    }
    if (filters?.difficulty && filters.difficulty !== 'all') {
      fallback = fallback.filter((q) => q.difficulty === filters.difficulty)
    }
    if (filters?.topic && filters.topic !== 'all') {
      fallback = fallback.filter(
        (q) => q.topic.toLowerCase() === filters.topic?.toLowerCase()
      )
    }
    return fallback
  }

  /**
   * Fetch a single question by ID from Supabase
   */
  static async getQuestionById(id: string): Promise<Question | null> {
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle()

      if (!error && data) {
        return this.mapRowToQuestion(data as unknown as DatabaseQuestion)
      }
    } catch (err) {
      console.warn(`Supabase getQuestionById(${id}) note:`, err)
    }

    const fallbackQ = INITIAL_QUESTIONS.find((q) => q.id === id)
    return fallbackQ || null
  }

  /**
   * Fetch all progress records for a user from Supabase and LocalStorage cache
   */
  static async getUserProgress(
    userId: string
  ): Promise<Record<string, UserQuestionProgress>> {
    const progressMap: Record<string, UserQuestionProgress> = {}

    // 1. First load from LocalStorage cache for instant responsiveness
    const localData = getStoredItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`)
    if (localData) {
      try {
        const parsed = JSON.parse(localData) as Record<string, UserQuestionProgress>
        Object.assign(progressMap, parsed)
      } catch {
        // ignore
      }
    }

    // 2. Query Supabase for cloud-synced user progress
    try {
      const { data, error } = await supabase
        .from('user_question_progress')
        .select('*')
        .eq('user_id', userId)

      if (!error && data) {
        data.forEach((row: Record<string, unknown>) => {
          const qId = String(row.question_id)
          progressMap[qId] = {
            questionId: qId,
            isSolved: Boolean(row.is_solved),
            isCorrect: Boolean(row.is_correct),
            isBookmarked: Boolean(row.is_bookmarked),
            selectedOption: row.selected_option ? String(row.selected_option) : undefined,
            attemptsCount: Number(row.attempts_count) || 1,
            timeSpentSeconds: Number(row.time_spent_seconds) || 0,
            lastAttemptedAt: String(row.last_attempted_at || new Date().toISOString()),
          }
        })

        // Update local storage with fresh Supabase state
        setStoredItem(
          `${LOCAL_STORAGE_KEY_PREFIX}${userId}`,
          JSON.stringify(progressMap)
        )
      }
    } catch (cloudErr) {
      console.warn('Supabase progress fetch note:', cloudErr)
    }

    return progressMap
  }

  /**
   * Get all questions with current user progress attached, sorted by Unsolved-First Queue
   */
  static async getQuestionsWithProgress(
    userId?: string,
    filters?: Partial<QuestionFilters>
  ): Promise<{
    questions: Question[]
    progressMap: Record<string, UserQuestionProgress>
    challengeBonusXp: number
    contestXp: number
    authoritativeTotalXp?: number
  }> {
    const [rawQuestions, progressMap, challengeBonusXp, contestXp, rankRes] = await Promise.all([
      this.getQuestions(filters),
      userId ? this.getUserProgress(userId) : Promise.resolve({}),
      userId ? this.getUserChallengeBonusXp(userId) : Promise.resolve(0),
      userId ? this.getUserContestXp(userId) : Promise.resolve(0),
      userId
        ? LeaderboardService.getUserGlobalRank(userId)
        : Promise.resolve<UserGlobalRankResult>({ found: false }),
    ])

    // Intelligently sort questions: Unsolved first, Solved last
    const questions = userId
      ? this.sortQuestionsForUser(rawQuestions, progressMap)
      : rawQuestions

    return {
      questions,
      progressMap,
      challengeBonusXp,
      contestXp,
      authoritativeTotalXp: rankRes.found ? rankRes.totalXp : undefined,
    }
  }

  /**
   * Fetch total Daily Challenge bonus XP awarded to the user from public.user_daily_challenge_completions.
   * Authoritative, persistent, and read-only.
   */
  static async getUserChallengeBonusXp(userId: string): Promise<number> {
    if (!userId) return 0
    try {
      const { data, error } = await supabase
        .from('user_daily_challenge_completions')
        .select('bonus_xp_awarded')
        .eq('user_id', userId)

      if (!error && data && data.length > 0) {
        return data.reduce((sum, row) => sum + (Number(row.bonus_xp_awarded) || 0), 0)
      }
    } catch (err) {
      console.warn('Supabase fetch challenge bonus XP note:', err)
    }
    return 0
  }

  /**
   * Fetch total tournament Contest XP awarded to the user from public.contest_participants.
   * Authoritative, persistent, and read-only.
   */
  static async getUserContestXp(userId: string): Promise<number> {
    if (!userId) return 0
    try {
      const { data, error } = await supabase
        .from('contest_participants')
        .select('xp_awarded')
        .eq('user_id', userId)
        .eq('status', 'completed')

      if (!error && data && data.length > 0) {
        return data.reduce((sum, row) => sum + (Number(row.xp_awarded) || 0), 0)
      }
    } catch (err) {
      console.warn('Supabase fetch contest XP note:', err)
    }
    return 0
  }

  /**
   * Fetch user attempt history from Supabase with local cache fallback
   */
  static async getUserAttempts(
    userId: string,
    limit = 50
  ): Promise<UserQuestionAttempt[]> {
    const attemptsList: UserQuestionAttempt[] = []

    // 1. Load local cache
    const local = getStoredItem(`${LOCAL_ATTEMPTS_KEY_PREFIX}${userId}`)
    if (local) {
      try {
        const parsed = JSON.parse(local) as UserQuestionAttempt[]
        if (Array.isArray(parsed)) {
          attemptsList.push(...parsed)
        }
      } catch {
        // ignore
      }
    }

    // 2. Query Supabase
    try {
      const { data, error } = await supabase
        .from('user_question_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (!error && data && data.length > 0) {
        const freshAttempts: UserQuestionAttempt[] = data.map((row: Record<string, unknown>) => ({
          id: String(row.id),
          userId: String(row.user_id),
          questionId: String(row.question_id),
          selectedOption: String(row.selected_option || ''),
          isCorrect: Boolean(row.is_correct),
          xpChange: Number(row.xp_change) || 0,
          attemptNumber: Number(row.attempt_number) || 1,
          timeSpentSeconds: Number(row.time_spent_seconds) || 0,
          createdAt: String(row.created_at || new Date().toISOString()),
        }))

        // Update local cache
        setStoredItem(
          `${LOCAL_ATTEMPTS_KEY_PREFIX}${userId}`,
          JSON.stringify(freshAttempts)
        )
        return freshAttempts
      }
    } catch (err) {
      console.warn('Supabase fetch attempts note:', err)
    }

    return attemptsList.slice(0, limit)
  }

  /**
   * Get attempt breakdown for a specific question and user
   */
  static async getQuestionAttempts(
    questionId: string,
    userId?: string
  ): Promise<{
    attempts: UserQuestionAttempt[]
    totalAttempts: number
    correctCount: number
    incorrectCount: number
  }> {
    if (!userId) {
      return { attempts: [], totalAttempts: 0, correctCount: 0, incorrectCount: 0 }
    }

    const allUserAttempts = await this.getUserAttempts(userId, 100)
    const questionAttempts = allUserAttempts.filter((a) => a.questionId === questionId)

    let correctCount = 0
    let incorrectCount = 0
    questionAttempts.forEach((a) => {
      if (a.isCorrect) correctCount++
      else incorrectCount++
    })

    return {
      attempts: questionAttempts,
      totalAttempts: questionAttempts.length,
      correctCount,
      incorrectCount,
    }
  }

  /**
   * Submit an answer to a question, evaluate correctness via centralized XP engine,
   * insert an immutable attempt record, and sync progress.
   */
  static async submitAnswer(
    questionId: string,
    selectedOption: string,
    timeSpentSeconds: number,
    userId?: string
  ): Promise<{
    isCorrect: boolean
    correctOption: string
    xpChange: number
    xpReason: string
    attemptNumber: number
    progress: UserQuestionProgress
    attempt?: UserQuestionAttempt
  }> {
    // 1. Load authoritative question from database / cache
    const question = await this.getQuestionById(questionId)
    if (!question) {
      throw new Error(`Question ${questionId} not found`)
    }

    const cleanSelected = selectedOption.trim().toUpperCase()
    const cleanCorrect = question.correctOption.trim().toUpperCase()
    const isCorrect = cleanSelected === cleanCorrect

    // 2. Load existing progress
    let existingProgress: UserQuestionProgress | undefined
    if (userId) {
      const local = getStoredItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`)
      if (local) {
        try {
          const map = JSON.parse(local)
          existingProgress = map[questionId]
        } catch {
          // ignore
        }
      }
    }

    const wasAlreadySolved = existingProgress?.isSolved ?? false
    const attemptNumber = (existingProgress?.attemptsCount ?? 0) + 1

    // 3. Centralized XP calculation (First solve vs reattempt vs negative marking)
    const { xpChange, reason: xpReason } = this.calculateXPChange(
      question.points,
      isCorrect,
      wasAlreadySolved
    )

    const updatedProgress: UserQuestionProgress = {
      questionId,
      isSolved: isCorrect || wasAlreadySolved,
      isCorrect,
      isBookmarked: existingProgress?.isBookmarked ?? false,
      selectedOption: cleanSelected,
      attemptsCount: attemptNumber,
      timeSpentSeconds: (existingProgress?.timeSpentSeconds ?? 0) + timeSpentSeconds,
      lastAttemptedAt: new Date().toISOString(),
    }

    let createdAttempt: UserQuestionAttempt | undefined

    // 4. Record progress and attempt in local cache
    if (userId) {
      const localKey = `${LOCAL_STORAGE_KEY_PREFIX}${userId}`
      let currentMap: Record<string, UserQuestionProgress> = {}
      const currentStored = getStoredItem(localKey)
      if (currentStored) {
        try {
          currentMap = JSON.parse(currentStored)
        } catch {
          currentMap = {}
        }
      }
      currentMap[questionId] = updatedProgress
      setStoredItem(localKey, JSON.stringify(currentMap))

      createdAttempt = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId,
        questionId,
        selectedOption: cleanSelected,
        isCorrect,
        xpChange,
        attemptNumber,
        timeSpentSeconds,
        createdAt: new Date().toISOString(),
        questionTitle: question.title,
        questionCategory: question.category,
        questionDifficulty: question.difficulty,
      }

      // Add to local attempts list
      const localAttemptsKey = `${LOCAL_ATTEMPTS_KEY_PREFIX}${userId}`
      let attemptsArr: UserQuestionAttempt[] = []
      const currentAttemptsStored = getStoredItem(localAttemptsKey)
      if (currentAttemptsStored) {
        try {
          attemptsArr = JSON.parse(currentAttemptsStored)
        } catch {
          attemptsArr = []
        }
      }
      attemptsArr.unshift(createdAttempt)
      setStoredItem(localAttemptsKey, JSON.stringify(attemptsArr))

      // 5. Cloud-sync to Supabase tables asynchronously
      ;(async () => {
        try {
          // A. Upsert progress
          const { error: progErr } = await supabase
            .from('user_question_progress')
            .upsert(
              {
                user_id: userId,
                question_id: questionId,
                selected_option: cleanSelected,
                is_solved: updatedProgress.isSolved,
                is_correct: isCorrect,
                is_bookmarked: updatedProgress.isBookmarked,
                attempts_count: updatedProgress.attemptsCount,
                time_spent_seconds: updatedProgress.timeSpentSeconds,
                last_attempted_at: updatedProgress.lastAttemptedAt,
              },
              { onConflict: 'user_id,question_id' }
            )
          if (progErr) {
            console.warn('Supabase progress upsert note:', progErr.message)
          }

          // B. Insert attempt history log
          const { error: attErr } = await supabase
            .from('user_question_attempts')
            .insert({
              user_id: userId,
              question_id: questionId,
              selected_option: cleanSelected,
              is_correct: isCorrect,
              xp_change: xpChange,
              attempt_number: attemptNumber,
              time_spent_seconds: timeSpentSeconds,
            })
          if (attErr) {
            console.warn('Supabase attempt insert note:', attErr.message)
          }

          // C. If solved correctly, advance/maintain daily streak idempotently via trusted RPC
          if (isCorrect) {
            StreakService.recordDailyActivity(userId).catch(() => {})
          }
        } catch (e) {
          console.warn('Supabase sync network note:', e)
        }
      })()
    }

    return {
      isCorrect,
      correctOption: question.correctOption,
      xpChange,
      xpReason,
      attemptNumber,
      progress: updatedProgress,
      attempt: createdAttempt,
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
      const currentStored = getStoredItem(localKey)
      if (currentStored) {
        try {
          currentMap = JSON.parse(currentStored)
        } catch {
          currentMap = {}
        }
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
      setStoredItem(localKey, JSON.stringify(currentMap))

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
   * Get randomized questions from the database pool, preferring unsolved
   */
  static async getRandomQuestions(options?: {
    filters?: Partial<QuestionFilters>
    limit?: number
    userId?: string
    excludeSolved?: boolean
  }): Promise<Question[]> {
    const { questions, progressMap } = await this.getQuestionsWithProgress(
      options?.userId,
      options?.filters
    )

    let pool = [...questions]

    if (options?.excludeSolved && options.userId) {
      const unsolved = pool.filter((q) => !progressMap[q.id]?.isSolved)
      if (unsolved.length > 0) {
        pool = unsolved
      }
    }

    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }

    const limit = options?.limit || pool.length
    return pool.slice(0, limit)
  }

  /**
   * Calculate summary statistics for question bank and athlete progression
   */
  static calculateStats(
    questions: Question[],
    progressMap: Record<string, UserQuestionProgress>,
    attemptsList: UserQuestionAttempt[] = [],
    challengeBonusXp = 0,
    contestXp = 0,
    authoritativeTotalXp?: number
  ): QuestionBankStats {
    let solvedCount = 0
    let easySolved = 0
    let easyTotal = 0
    let mediumSolved = 0
    let mediumTotal = 0
    let hardSolved = 0
    let hardTotal = 0
    let bookmarkedCount = 0
    let totalAttempts = 0
    let correctAttempts = 0
    let incorrectAttempts = 0
    let xpEarned = 0
    let xpLost = 0

    // Question bank difficulty breakdown
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
        xpEarned += q.points
      }

      if (prog?.isBookmarked) {
        bookmarkedCount++
      }

      if (prog) {
        totalAttempts += prog.attemptsCount
        if (prog.isCorrect) {
          correctAttempts++
        } else if (prog.attemptsCount > 0) {
          const penalty = Math.max(1, Math.round(q.points * 0.25))
          xpLost += penalty * prog.attemptsCount
        }
      }
    })

    // If explicit attempt history is available, calculate exact attempt metrics
    if (attemptsList.length > 0) {
      totalAttempts = attemptsList.length
      correctAttempts = 0
      incorrectAttempts = 0
      xpEarned = 0
      xpLost = 0

      attemptsList.forEach((att) => {
        if (att.isCorrect) {
          correctAttempts++
          if (att.xpChange > 0) {
            xpEarned += att.xpChange
          }
        } else {
          incorrectAttempts++
          if (att.xpChange < 0) {
            xpLost += Math.abs(att.xpChange)
          }
        }
      })
    } else {
      incorrectAttempts = Math.max(0, totalAttempts - correctAttempts)
    }

    // Add authoritative Daily Challenge bonus XP and Contest Tournament XP to total XP earned
    xpEarned += Math.max(0, challengeBonusXp)
    xpEarned += Math.max(0, contestXp)

    // Authoritative Unified XP: Prefer the server-authoritative unified rank value if provided,
    // otherwise fallback to calculated MAX(0, xpEarned - xpLost)
    const netXp = typeof authoritativeTotalXp === 'number'
      ? Math.max(0, authoritativeTotalXp)
      : Math.max(0, xpEarned - xpLost)

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
      totalPoints: netXp,
      totalAttempts,
      correctAttempts,
      incorrectAttempts,
      xpEarned,
      xpLost,
      netXp,
      challengeBonusXp,
      contestXp,
      authoritativeTotalXp: typeof authoritativeTotalXp === 'number' ? authoritativeTotalXp : netXp,
    }
  }
}
