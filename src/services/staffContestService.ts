import { supabase } from '../lib/supabase'
import type {
  Contest,
  DatabaseContest,
  ContestStatus,
  ContestType,
  StaffContestQuestion,
  StaffCreateContestPayload,
  StaffUpdateContestPayload,
  StaffContestStats,
} from '../types/contests'

export interface StaffContestParticipantOverview {
  total: number
  registered: number
  inProgress: number
  completed: number
  disqualified: number
  abandoned: number
}

export class StaffContestService {
  /**
   * Determine authoritative dynamic status based on DB status and server-relative time
   */
  static computeContestStatus(
    dbStatus: string,
    startTimeStr: string,
    endTimeStr: string
  ): ContestStatus {
    if (dbStatus === 'draft') return 'draft'
    if (dbStatus === 'cancelled') return 'cancelled'

    const now = new Date().getTime()
    const start = new Date(startTimeStr).getTime()
    const end = new Date(endTimeStr).getTime()

    if (now >= end) return 'completed'
    if (now >= start && now < end) return 'live'
    return 'upcoming'
  }

  /**
   * Map database row to typed Contest model
   */
  private static mapContest(row: DatabaseContest, participantCount = 0): Contest {
    const computedStatus = this.computeContestStatus(
      row.status,
      row.start_time,
      row.end_time
    )

    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      description: row.description,
      category: row.category,
      difficulty: (row.difficulty as Contest['difficulty']) || 'open',
      contestType: (row.contest_type as ContestType) || 'weekly',
      status: computedStatus,
      startTime: row.start_time,
      endTime: row.end_time,
      durationMinutes: row.duration_minutes,
      totalQuestions: row.total_questions || 0,
      totalMarks: Number(row.total_marks) || 0,
      positiveMarksPerQuestion: Number(row.positive_marks_per_question) || 4,
      negativeMarksPerQuestion: Number(row.negative_marks_per_question) || 1,
      xpPool: row.xp_pool || 1000,
      rules: row.rules,
      syllabus: row.syllabus,
      bannerUrl: row.banner_url || null,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      participantsCount: participantCount,
    }
  }

  /**
   * Fetch all contests with participant counts and stats breakdown
   */
  static async fetchStaffContests(params?: {
    statusFilter?: ContestStatus | 'all'
    searchQuery?: string
  }): Promise<{
    contests: Contest[]
    stats: StaffContestStats
    error?: string
  }> {
    try {
      // 1. Query all contests
      const { data: contestsData, error: contestsError } = await supabase
        .from('contests')
        .select('*')
        .order('created_at', { ascending: false })

      if (contestsError) {
        return {
          contests: [],
          stats: { all: 0, draft: 0, upcoming: 0, live: 0, completed: 0, cancelled: 0 },
          error: contestsError.message,
        }
      }

      const rows = (contestsData as DatabaseContest[]) || []

      // 2. Fetch participant counts grouped by contest_id
      const { data: partData } = await supabase
        .from('contest_participants')
        .select('contest_id')

      const countMap: Record<string, number> = {}
      if (partData) {
        for (const row of partData) {
          countMap[row.contest_id] = (countMap[row.contest_id] || 0) + 1
        }
      }

      // 3. Map all contests and calculate stats
      const stats: StaffContestStats = {
        all: rows.length,
        draft: 0,
        upcoming: 0,
        live: 0,
        completed: 0,
        cancelled: 0,
      }

      const mappedContests: Contest[] = rows.map((r) => {
        const c = this.mapContest(r, countMap[r.id] || 0)
        if (c.status in stats) {
          stats[c.status]++
        }
        return c
      })

      // 4. Apply client-side filters
      let filtered = mappedContests

      if (params?.statusFilter && params.statusFilter !== 'all') {
        filtered = filtered.filter((c) => c.status === params.statusFilter)
      }

      if (params?.searchQuery && params.searchQuery.trim() !== '') {
        const q = params.searchQuery.toLowerCase().trim()
        filtered = filtered.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.slug.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q)
        )
      }

      return {
        contests: filtered,
        stats,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch contests'
      return {
        contests: [],
        stats: { all: 0, draft: 0, upcoming: 0, live: 0, completed: 0, cancelled: 0 },
        error: msg,
      }
    }
  }

  /**
   * Fetch single contest details, mapped questions, and participant breakdown
   */
  static async fetchStaffContestById(contestId: string): Promise<{
    contest?: Contest
    questions: StaffContestQuestion[]
    participantStats: StaffContestParticipantOverview
    error?: string
  }> {
    try {
      // 1. Contest record
      const { data: contestData, error: contestError } = await supabase
        .from('contests')
        .select('*')
        .eq('id', contestId)
        .single()

      if (contestError || !contestData) {
        return {
          questions: [],
          participantStats: { total: 0, registered: 0, inProgress: 0, completed: 0, disqualified: 0, abandoned: 0 },
          error: contestError?.message || 'Contest not found',
        }
      }

      // 2. Fetch assigned questions via RPC staff_get_contest_questions
      const { data: qData, error: qErr } = await supabase.rpc('staff_get_contest_questions', {
        p_contest_id: contestId,
      })

      const questions: StaffContestQuestion[] =
        !qErr && qData && qData.success && Array.isArray(qData.questions)
          ? qData.questions
          : []

      // 3. Fetch participant breakdown
      const { data: pRows } = await supabase
        .from('contest_participants')
        .select('status')
        .eq('contest_id', contestId)

      const pStats: StaffContestParticipantOverview = {
        total: pRows?.length || 0,
        registered: 0,
        inProgress: 0,
        completed: 0,
        disqualified: 0,
        abandoned: 0,
      }

      if (pRows) {
        for (const p of pRows) {
          if (p.status === 'registered') pStats.registered++
          else if (p.status === 'in_progress') pStats.inProgress++
          else if (p.status === 'completed') pStats.completed++
          else if (p.status === 'disqualified') pStats.disqualified++
          else if (p.status === 'abandoned') pStats.abandoned++
        }
      }

      const contest = this.mapContest(contestData as DatabaseContest, pStats.total)

      return {
        contest,
        questions,
        participantStats: pStats,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch contest details'
      return {
        questions: [],
        participantStats: { total: 0, registered: 0, inProgress: 0, completed: 0, disqualified: 0, abandoned: 0 },
        error: msg,
      }
    }
  }

  /**
   * Create a contest
   */
  static async createContest(payload: StaffCreateContestPayload): Promise<{
    success: boolean
    contest_id?: string
    message?: string
    error?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('staff_create_contest', {
        p_title: payload.title,
        p_slug: payload.slug,
        p_description: payload.description || null,
        p_category: payload.category || 'Quantitative Aptitude',
        p_difficulty: payload.difficulty || 'open',
        p_contest_type: payload.contest_type || 'weekly',
        p_start_time: payload.start_time,
        p_end_time: payload.end_time,
        p_duration_minutes: payload.duration_minutes,
        p_positive_marks: payload.positive_marks || 4.0,
        p_negative_marks: payload.negative_marks ?? 1.0,
        p_xp_pool: payload.xp_pool || 1000,
        p_rules: payload.rules || null,
        p_syllabus: payload.syllabus || null,
        p_banner_url: payload.banner_url || null,
        p_status: payload.status || 'draft',
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return data as { success: boolean; contest_id?: string; message?: string; error?: string }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Contest creation failed'
      return { success: false, error: msg }
    }
  }

  /**
   * Update contest configuration
   */
  static async updateContest(
    contestId: string,
    payload: StaffUpdateContestPayload
  ): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('staff_update_contest', {
        p_contest_id: contestId,
        p_title: payload.title,
        p_slug: payload.slug,
        p_description: payload.description || null,
        p_category: payload.category,
        p_difficulty: payload.difficulty,
        p_contest_type: payload.contest_type,
        p_start_time: payload.start_time || null,
        p_end_time: payload.end_time || null,
        p_duration_minutes: payload.duration_minutes || null,
        p_positive_marks: payload.positive_marks || null,
        p_negative_marks: payload.negative_marks ?? null,
        p_xp_pool: payload.xp_pool || null,
        p_rules: payload.rules || null,
        p_syllabus: payload.syllabus || null,
        p_banner_url: payload.banner_url || null,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return data as { success: boolean; message?: string; error?: string }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Contest update failed'
      return { success: false, error: msg }
    }
  }

  /**
   * Transition contest status
   */
  static async setContestStatus(
    contestId: string,
    newStatus: ContestStatus
  ): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('staff_set_contest_status', {
        p_contest_id: contestId,
        p_new_status: newStatus,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return data as { success: boolean; message?: string; error?: string }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Status update failed'
      return { success: false, error: msg }
    }
  }

  /**
   * Add question to contest
   */
  static async addContestQuestion(
    contestId: string,
    questionId: string,
    marks = 4.0,
    negativeMarks = 1.0
  ): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('staff_add_contest_question', {
        p_contest_id: contestId,
        p_question_id: questionId,
        p_marks: marks,
        p_negative_marks: negativeMarks,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return data as { success: boolean; message?: string; error?: string }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add question to contest'
      return { success: false, error: msg }
    }
  }

  /**
   * Remove question from contest
   */
  static async removeContestQuestion(
    contestId: string,
    questionId: string
  ): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('staff_remove_contest_question', {
        p_contest_id: contestId,
        p_question_id: questionId,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return data as { success: boolean; message?: string; error?: string }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove question from contest'
      return { success: false, error: msg }
    }
  }

  /**
   * Reorder contest questions
   */
  static async reorderContestQuestions(
    contestId: string,
    questionIds: string[]
  ): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('staff_reorder_contest_questions', {
        p_contest_id: contestId,
        p_question_ids: questionIds,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return data as { success: boolean; message?: string; error?: string }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reorder questions'
      return { success: false, error: msg }
    }
  }

  /**
   * Delete contest (draft only, or 0 participants/answers)
   */
  static async deleteContest(contestId: string): Promise<{
    success: boolean
    message?: string
    error?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('staff_delete_contest', {
        p_contest_id: contestId,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return data as { success: boolean; message?: string; error?: string }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete contest'
      return { success: false, error: msg }
    }
  }

  /**
   * Query Question Bank questions to assign to a contest.
   * EXCLUSIVELY selects active questions (is_active = true).
   * Dedicated contest questions (is_active = false) are never returned.
   */
  static async fetchAvailableQuestionsForPicker(params: {
    contestId: string
    category?: string
    difficulty?: string
    search?: string
  }): Promise<{
    questions: Array<{
      id: string
      title: string
      category: string
      topic: string
      difficulty: string
      isActive: boolean
      isAssigned: boolean
    }>
    error?: string
  }> {
    try {
      // 1. Fetch all assigned question IDs for this contest
      const { data: assignedRows } = await supabase
        .from('contest_questions')
        .select('question_id')
        .eq('contest_id', params.contestId)

      const assignedSet = new Set((assignedRows || []).map((r) => r.question_id))

      // 2. Fetch candidate questions from public.questions with is_active = true
      let query = supabase
        .from('questions')
        .select('id, title, category, topic, difficulty, is_active')
        .eq('is_active', true)
        .order('id', { ascending: true })
        .limit(100)

      if (params.category && params.category !== 'all') {
        query = query.eq('category', params.category)
      }

      if (params.difficulty && params.difficulty !== 'all') {
        query = query.eq('difficulty', params.difficulty)
      }

      if (params.search && params.search.trim() !== '') {
        const q = params.search.trim()
        query = query.or(`id.ilike.%${q}%,title.ilike.%${q}%,topic.ilike.%${q}%`)
      }

      const { data: questionsData, error: qErr } = await query

      if (qErr) {
        return { questions: [], error: qErr.message }
      }

      // Safe secondary client-side filter to guarantee NO inactive question leaks through
      const activeRows = (questionsData || []).filter((q) => q.is_active === true)

      const questions = activeRows.map((q) => ({
        id: q.id,
        title: q.title,
        category: q.category,
        topic: q.topic,
        difficulty: q.difficulty,
        isActive: q.is_active === true,
        isAssigned: assignedSet.has(q.id),
      }))

      return { questions }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load questions'
      return { questions: [], error: msg }
    }
  }
}
