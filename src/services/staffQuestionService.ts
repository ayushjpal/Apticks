import { supabase } from '../lib/supabase'
import type { Category, Difficulty, QuestionOption, DatabaseQuestion } from '../types/questions'

export interface StaffQuestion extends Omit<DatabaseQuestion, 'options' | 'hints' | 'tags' | 'is_active'> {
  options: QuestionOption[]
  hints: string[]
  tags: string[]
  is_active: boolean
  isContestQuestion?: boolean
  contestCount?: number
}

export interface CreateQuestionPayload {
  title: string
  prompt: string
  category: Category
  topic: string
  difficulty: Difficulty
  options: QuestionOption[]
  correct_option: string
  explanation: string
  formula_or_rule?: string
  hints?: string[]
  points?: number
  tags?: string[]
  is_active?: boolean
  custom_id?: string
}

export interface UpdateQuestionPayload {
  id: string
  title: string
  prompt: string
  category: Category
  topic: string
  difficulty: Difficulty
  options: QuestionOption[]
  correct_option: string
  explanation: string
  formula_or_rule?: string
  hints?: string[]
  points?: number
  tags?: string[]
  is_active?: boolean
}

export interface StaffQuestionStats {
  total: number
  active: number
  inactive: number
  contestQuestions: number
  byCategory: Record<string, number>
}

export interface StaffRpcResult {
  success: boolean
  message: string
  error?: string
  question?: StaffQuestion
  is_active?: boolean
  question_id?: string
}

/**
 * Normalizes raw JSONB or string fields into proper array formats
 */
function normalizeArrayField<T>(field: unknown, fallback: T[] = []): T[] {
  if (!field) return fallback
  if (Array.isArray(field)) return field as T[]
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field)
      return Array.isArray(parsed) ? (parsed as T[]) : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

export const StaffQuestionService = {
  /**
   * Fetch all questions with staff visibility (both active and inactive),
   * joined with contest mappings to flag contest-dedicated questions.
   */
  async fetchStaffQuestions(): Promise<{ questions: StaffQuestion[]; stats: StaffQuestionStats; error: string | null }> {
    try {
      // 1. Fetch questions
      const { data: rawQuestions, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .order('id', { ascending: true })

      if (qErr) {
        console.error('Error fetching questions for staff:', qErr)
        return {
          questions: [],
          stats: { total: 0, active: 0, inactive: 0, contestQuestions: 0, byCategory: {} },
          error: qErr.message,
        }
      }

      // 2. Fetch contest question mappings to identify contest-bound questions
      const { data: contestMappings } = await supabase
        .from('contest_questions')
        .select('question_id, contest_id')

      const contestMap = new Map<string, number>()
      if (contestMappings) {
        for (const mapping of contestMappings) {
          const current = contestMap.get(mapping.question_id) || 0
          contestMap.set(mapping.question_id, current + 1)
        }
      }

      // 3. Format and enrich questions
      let activeCount = 0
      let inactiveCount = 0
      let contestCountTotal = 0
      const byCategory: Record<string, number> = {}

      const formattedQuestions: StaffQuestion[] = (rawQuestions || []).map((q) => {
        const isActive = q.is_active !== false
        const isContest = contestMap.has(q.id)

        if (isActive) activeCount++
        else inactiveCount++

        if (isContest) contestCountTotal++

        byCategory[q.category] = (byCategory[q.category] || 0) + 1

        return {
          ...q,
          options: normalizeArrayField<QuestionOption>(q.options),
          hints: normalizeArrayField<string>(q.hints),
          tags: normalizeArrayField<string>(q.tags),
          is_active: isActive,
          isContestQuestion: isContest,
          contestCount: contestMap.get(q.id) || 0,
        }
      })

      return {
        questions: formattedQuestions,
        stats: {
          total: formattedQuestions.length,
          active: activeCount,
          inactive: inactiveCount,
          contestQuestions: contestCountTotal,
          byCategory,
        },
        error: null,
      }
    } catch (err) {
      console.error('Unexpected error fetching staff questions:', err)
      return {
        questions: [],
        stats: { total: 0, active: 0, inactive: 0, contestQuestions: 0, byCategory: {} },
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  },

  /**
   * Request the next concurrency-safe sequential question ID for a given category.
   * Uses atomic row locking on question_sequences.
   */
  async getNextQuestionId(category: Category): Promise<{ id: string | null; error: string | null }> {
    try {
      const { data, error } = await supabase.rpc('staff_get_next_question_id', {
        p_category: category,
      })

      if (error) {
        console.warn('staff_get_next_question_id RPC failed, computing local suggestion:', error.message)
        // Fallback prefix generation for UI convenience if migration not yet applied
        const prefix =
          category === 'Quantitative Aptitude'
            ? 'quant'
            : category === 'Logical Reasoning'
            ? 'lr'
            : category === 'Data Interpretation'
            ? 'di'
            : 'verbal'
        return { id: `${prefix}-NEXT`, error: error.message }
      }

      return { id: typeof data === 'string' ? data : null, error: null }
    } catch (err) {
      return { id: null, error: err instanceof Error ? err.message : 'Failed to generate ID' }
    }
  },

  /**
   * Author a new question via SECURITY DEFINER RPC.
   * Performs full server-side validation and atomic sequence increment.
   */
  async createQuestion(payload: CreateQuestionPayload): Promise<StaffRpcResult> {
    try {
      const { data, error } = await supabase.rpc('staff_create_question', {
        p_title: payload.title.trim(),
        p_prompt: payload.prompt.trim(),
        p_category: payload.category,
        p_topic: payload.topic.trim(),
        p_difficulty: payload.difficulty,
        p_options: payload.options,
        p_correct_option: payload.correct_option.trim().toUpperCase(),
        p_explanation: payload.explanation.trim(),
        p_formula_or_rule: payload.formula_or_rule?.trim() || null,
        p_hints: payload.hints || [],
        p_points: payload.points || 10,
        p_tags: payload.tags || [],
        p_is_active: payload.is_active ?? false,
        p_custom_id: payload.custom_id?.trim() || null,
      })

      if (error) {
        return {
          success: false,
          error: error.code || 'RPC_ERROR',
          message: error.message,
        }
      }

      return data as StaffRpcResult
    } catch (err) {
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error creating question',
      }
    }
  },

  /**
   * Update an existing question via SECURITY DEFINER RPC.
   */
  async updateQuestion(payload: UpdateQuestionPayload): Promise<StaffRpcResult> {
    try {
      const { data, error } = await supabase.rpc('staff_update_question', {
        p_question_id: payload.id,
        p_title: payload.title.trim(),
        p_prompt: payload.prompt.trim(),
        p_category: payload.category,
        p_topic: payload.topic.trim(),
        p_difficulty: payload.difficulty,
        p_options: payload.options,
        p_correct_option: payload.correct_option.trim().toUpperCase(),
        p_explanation: payload.explanation.trim(),
        p_formula_or_rule: payload.formula_or_rule?.trim() || null,
        p_hints: payload.hints || [],
        p_points: payload.points || 10,
        p_tags: payload.tags || [],
        p_is_active: payload.is_active,
      })

      if (error) {
        return {
          success: false,
          error: error.code || 'RPC_ERROR',
          message: error.message,
        }
      }

      return data as StaffRpcResult
    } catch (err) {
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error updating question',
      }
    }
  },

  /**
   * Toggle question active status via SECURITY DEFINER RPC.
   * Safeguarded against deactivating questions in active Live Contests.
   */
  async toggleQuestionActive(questionId: string, isActive: boolean): Promise<StaffRpcResult> {
    try {
      const { data, error } = await supabase.rpc('staff_toggle_question_active', {
        p_question_id: questionId,
        p_is_active: isActive,
      })

      if (error) {
        return {
          success: false,
          error: error.code || 'RPC_ERROR',
          message: error.message,
        }
      }

      return data as StaffRpcResult
    } catch (err) {
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error toggling question status',
      }
    }
  },

  /**
   * Delete question via SECURITY DEFINER RPC.
   * Rejects deletion if question is assigned to contests or has student attempts.
   */
  async deleteQuestion(questionId: string): Promise<StaffRpcResult> {
    try {
      const { data, error } = await supabase.rpc('staff_delete_question', {
        p_question_id: questionId,
      })

      if (error) {
        return {
          success: false,
          error: error.code || 'RPC_ERROR',
          message: error.message,
        }
      }

      return data as StaffRpcResult
    } catch (err) {
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error deleting question',
      }
    }
  },
}
