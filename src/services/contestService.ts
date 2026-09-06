import { supabase } from '../lib/supabase'
import type {
  Contest,
  ContestQuestion,
  ContestSession,
  ContestSubmissionAnswer,
  ContestSubmissionResult,
  ContestLeaderboardEntry,
  ContestReviewQuestion,
  UserContestStatus,
  DatabaseContest,
  ContestStatus,
} from '../types/contests'

export class ContestService {
  /**
   * Helper to normalize dynamic status based on current time
   */
  private static normalizeContestStatus(
    dbStatus: string,
    startTimeStr: string,
    endTimeStr: string
  ): ContestStatus {
    const now = new Date().getTime()
    const start = new Date(startTimeStr).getTime()
    const end = new Date(endTimeStr).getTime()

    if (dbStatus === 'draft') return 'draft'
    if (dbStatus === 'cancelled') return 'cancelled'
    if (now >= end) return 'completed'
    if (now >= start && now < end) return 'live'
    return 'upcoming'
  }

  /**
   * Map database row to typed Contest model
   */
  private static mapContest(row: DatabaseContest): Contest {
    const computedStatus = this.normalizeContestStatus(
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
      difficulty: row.difficulty as Contest['difficulty'],
      status: computedStatus,
      startTime: row.start_time,
      endTime: row.end_time,
      durationMinutes: row.duration_minutes,
      totalQuestions: row.total_questions,
      totalMarks: Number(row.total_marks),
      positiveMarksPerQuestion: Number(row.positive_marks_per_question),
      negativeMarksPerQuestion: Number(row.negative_marks_per_question),
      xpPool: row.xp_pool,
      rules: row.rules,
      syllabus: row.syllabus,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      participantsCount: 0,
      isRegistered: false,
      userStatus: null,
    }
  }

  /**
   * Fetch all active contests with participant counts and user registration state
   */
  static async getContests(): Promise<Contest[]> {
    try {
      // 1. Fetch active contests
      const { data: contestsData, error: contestsError } = await supabase
        .from('contests')
        .select('*')
        .eq('is_active', true)
        .order('start_time', { ascending: true })

      if (contestsError) {
        console.error('Error fetching contests:', contestsError)
        return []
      }

      if (!contestsData || contestsData.length === 0) {
        return []
      }

      const contests = (contestsData as DatabaseContest[]).map((row) =>
        this.mapContest(row)
      )

      // 2. Fetch participant counts for all contests
      const { data: countsData } = await supabase
        .from('contest_participants')
        .select('contest_id')

      const countsMap: Record<string, number> = {}
      if (countsData) {
        for (const row of countsData) {
          countsMap[row.contest_id] = (countsMap[row.contest_id] || 0) + 1
        }
      }

      // 3. Fetch current user's registration state if logged in
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const userRegistrationsMap: Record<string, string> = {}
      if (user) {
        const { data: userParts } = await supabase
          .from('contest_participants')
          .select('contest_id, status')
          .eq('user_id', user.id)

        if (userParts) {
          for (const p of userParts) {
            userRegistrationsMap[p.contest_id] = p.status
          }
        }
      }

      // 4. Enrich contests with counts and user registration
      for (const c of contests) {
        c.participantsCount = countsMap[c.id] || 0
        if (userRegistrationsMap[c.id]) {
          c.isRegistered = true
          c.userStatus = userRegistrationsMap[c.id] as Contest['userStatus']
        }
      }

      // Sort with live first, then upcoming by start_time, then completed
      return contests.sort((a, b) => {
        const order: Record<ContestStatus, number> = {
          live: 0,
          upcoming: 1,
          completed: 2,
          cancelled: 3,
          draft: 4,
        }
        const rankDiff = order[a.status] - order[b.status]
        if (rankDiff !== 0) return rankDiff
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      })
    } catch (err) {
      console.error('Unexpected error in getContests:', err)
      return []
    }
  }

  /**
   * Fetch single contest by ID or Slug
   */
  static async getContestById(idOrSlug: string): Promise<Contest | null> {
    try {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          idOrSlug
        )

      let query = supabase.from('contests').select('*')
      if (isUuid) {
        query = query.eq('id', idOrSlug)
      } else {
        query = query.eq('slug', idOrSlug)
      }

      const { data, error } = await query.single()
      if (error || !data) {
        console.error('Contest not found:', error)
        return null
      }

      const contest = this.mapContest(data as DatabaseContest)

      // Count participants
      const { count } = await supabase
        .from('contest_participants')
        .select('*', { count: 'exact', head: true })
        .eq('contest_id', contest.id)

      contest.participantsCount = count || 0

      // User registration check
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: part } = await supabase
          .from('contest_participants')
          .select('status')
          .eq('contest_id', contest.id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (part) {
          contest.isRegistered = true
          contest.userStatus = part.status as Contest['userStatus']
        }
      }

      return contest
    } catch (err) {
      console.error('Error in getContestById:', err)
      return null
    }
  }

  /**
   * Fetch user's full contest status in 1 trip via secure RPC
   */
  static async getUserContestStatus(
    contestId: string
  ): Promise<UserContestStatus> {
    try {
      const { data, error } = await supabase.rpc('get_user_contest_status', {
        p_contest_id: contestId,
      })

      if (error || !data) {
        return { found: false, isAuthenticated: false, isRegistered: false }
      }

      return {
        found: data.found ?? true,
        isAuthenticated: data.is_authenticated ?? false,
        isRegistered: data.is_registered ?? false,
        participantId: data.participant_id ?? null,
        status: data.status ?? null,
        startedAt: data.started_at ?? null,
        submittedAt: data.submitted_at ?? null,
        totalScore: data.total_score !== undefined ? Number(data.total_score) : null,
        rank: data.rank ?? null,
        timeTakenSeconds: data.time_taken_seconds ?? null,
        correctAnswersCount: data.correct_answers_count ?? null,
        wrongAnswersCount: data.wrong_answers_count ?? null,
        unattemptedCount: data.unattempted_count ?? null,
        accuracyPercentage:
          data.accuracy_percentage !== undefined
            ? Number(data.accuracy_percentage)
            : null,
        xpAwarded: data.xp_awarded ?? null,
        timeRemainingSeconds: data.time_remaining_seconds ?? null,
        serverTime: data.server_time,
      }
    } catch (err) {
      console.error('Error calling get_user_contest_status:', err)
      return { found: false, isAuthenticated: false, isRegistered: false }
    }
  }

  /**
   * Register authenticated user for contest
   */
  static async registerForContest(
    contestId: string
  ): Promise<{ success: boolean; message: string; alreadyRegistered?: boolean }> {
    try {
      const { data, error } = await supabase.rpc('register_for_contest', {
        p_contest_id: contestId,
      })

      if (error) {
        return {
          success: false,
          message: error.message || 'Failed to register for contest.',
        }
      }

      return {
        success: data?.success ?? false,
        message: data?.message || 'Registration updated.',
        alreadyRegistered: data?.already_registered ?? false,
      }
    } catch (err) {
      console.error('Error registering for contest:', err)
      return { success: false, message: 'Unexpected registration failure.' }
    }
  }

  /**
   * Start or resume contest arena session
   */
  static async startContestSession(
    contestId: string
  ): Promise<{ success: boolean; session?: ContestSession; error?: string; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('start_contest_session', {
        p_contest_id: contestId,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!data?.success) {
        return {
          success: false,
          error: data?.error || 'FAILED_TO_START',
          message: data?.message || 'Could not start contest session.',
        }
      }

      return {
        success: true,
        session: {
          participantId: data.participant_id,
          status: data.status,
          startedAt: data.started_at,
          durationMinutes: data.duration_minutes,
          timeRemainingSeconds: data.time_remaining_seconds,
          serverTime: data.server_time,
        },
      }
    } catch (err) {
      console.error('Error starting contest session:', err)
      return { success: false, error: 'UNKNOWN_ERROR' }
    }
  }

  /**
   * Fetch contest questions for active player (NEVER contains correct answers)
   */
  static async getContestQuestions(
    contestId: string
  ): Promise<{ success: boolean; questions: ContestQuestion[]; error?: string }> {
    try {
      const { data, error } = await supabase.rpc(
        'get_contest_questions_for_player',
        { p_contest_id: contestId }
      )

      if (error) {
        return { success: false, questions: [], error: error.message }
      }

      if (!data?.success) {
        return {
          success: false,
          questions: [],
          error: data?.message || 'Unauthorized question request.',
        }
      }

      const questions: ContestQuestion[] = (data.questions || []).map(
        (q: {
          question_id: string
          order_index: number
          title: string
          prompt: string
          category: string
          topic: string
          difficulty: string
          options: { id: string; text: string }[] | string
          marks: number
          negative_marks: number
        }) => ({
          questionId: q.question_id,
          orderIndex: q.order_index,
          title: q.title,
          prompt: q.prompt,
          category: q.category,
          topic: q.topic,
          difficulty: q.difficulty,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
          marks: Number(q.marks),
          negativeMarks: Number(q.negative_marks),
        })
      )

      return { success: true, questions }
    } catch (err) {
      console.error('Error fetching contest questions:', err)
      return { success: false, questions: [], error: 'NETWORK_ERROR' }
    }
  }

  /**
   * Submit contest answers for server-side grading
   */
  static async submitContestAnswers(
    contestId: string,
    answers: ContestSubmissionAnswer[]
  ): Promise<ContestSubmissionResult> {
    try {
      const { data, error } = await supabase.rpc(
        'submit_contest_participant_answers',
        {
          p_contest_id: contestId,
          p_answers: answers,
        }
      )

      if (error) {
        return {
          success: false,
          totalScore: 0,
          correctAnswersCount: 0,
          wrongAnswersCount: 0,
          unattemptedCount: 0,
          accuracyPercentage: 0,
          timeTakenSeconds: 0,
          rank: null,
          xpAwarded: 0,
          message: error.message,
          error: error.message,
        }
      }

      return {
        success: data?.success ?? false,
        alreadySubmitted: data?.already_submitted ?? false,
        totalScore: Number(data?.total_score || 0),
        correctAnswersCount: Number(data?.correct_answers_count || 0),
        wrongAnswersCount: Number(data?.wrong_answers_count || 0),
        unattemptedCount: Number(data?.unattempted_count || 0),
        accuracyPercentage: Number(data?.accuracy_percentage || 0),
        timeTakenSeconds: Number(data?.time_taken_seconds || 0),
        rank: data?.rank ?? null,
        xpAwarded: Number(data?.xp_awarded || 0),
        message: data?.message || 'Submission complete.',
      }
    } catch (err) {
      console.error('Error submitting contest answers:', err)
      return {
        success: false,
        totalScore: 0,
        correctAnswersCount: 0,
        wrongAnswersCount: 0,
        unattemptedCount: 0,
        accuracyPercentage: 0,
        timeTakenSeconds: 0,
        rank: null,
        xpAwarded: 0,
        message: 'Submission failed due to network error.',
        error: 'NETWORK_ERROR',
      }
    }
  }

  /**
   * Fetch contest leaderboard
   */
  static async getContestLeaderboard(
    contestId: string
  ): Promise<ContestLeaderboardEntry[]> {
    try {
      const { data, error } = await supabase.rpc('get_contest_leaderboard', {
        p_contest_id: contestId,
      })

      if (error || !data?.success) {
        console.error('Error fetching leaderboard:', error)
        return []
      }

      return (data.leaderboard || []).map(
        (row: {
          rank: number
          user_id: string
          username: string
          display_name: string
          avatar_url: string | null
          total_score: number
          time_taken_seconds: number
          correct_answers_count: number
          accuracy_percentage: number
          xp_awarded: number
          submitted_at: string
        }) => ({
          rank: row.rank,
          userId: row.user_id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          totalScore: Number(row.total_score),
          timeTakenSeconds: Number(row.time_taken_seconds),
          correctAnswersCount: Number(row.correct_answers_count),
          accuracyPercentage: Number(row.accuracy_percentage),
          xpAwarded: Number(row.xp_awarded),
          submittedAt: row.submitted_at,
        })
      )
    } catch (err) {
      console.error('Error fetching leaderboard:', err)
      return []
    }
  }

  /**
   * Fetch authorized post-contest question review with correct answers and explanations
   */
  static async getContestReview(
    contestId: string
  ): Promise<{
    success: boolean
    participant?: {
      totalScore: number
      rank: number | null
      correctAnswersCount: number
      wrongAnswersCount: number
      unattemptedCount: number
      accuracyPercentage: number
      timeTakenSeconds: number
      xpAwarded: number
    }
    questions: ContestReviewQuestion[]
    error?: string
  }> {
    try {
      const { data, error } = await supabase.rpc('get_contest_review_for_player', {
        p_contest_id: contestId,
      })

      if (error) {
        return { success: false, questions: [], error: error.message }
      }

      if (!data?.success) {
        return {
          success: false,
          questions: [],
          error: data?.message || 'Review not available.',
        }
      }

      const questions: ContestReviewQuestion[] = (data.questions || []).map(
        (q: {
          question_id: string
          order_index: number
          title: string
          prompt: string
          category: string
          topic: string
          difficulty: string
          options: { id: string; text: string }[] | string
          selected_option: string | null
          correct_option: string
          is_correct: boolean
          marks_awarded: number
          time_spent_seconds: number
          explanation: string
          formula_or_rule?: string | null
        }) => ({
          questionId: q.question_id,
          orderIndex: q.order_index,
          title: q.title,
          prompt: q.prompt,
          category: q.category,
          topic: q.topic,
          difficulty: q.difficulty,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
          selectedOption: q.selected_option,
          correctOption: q.correct_option,
          isCorrect: q.is_correct,
          marksAwarded: Number(q.marks_awarded),
          timeSpentSeconds: Number(q.time_spent_seconds),
          explanation: q.explanation,
          formulaOrRule: q.formula_or_rule,
        })
      )

      return {
        success: true,
        participant: data.participant
          ? {
              totalScore: Number(data.participant.total_score),
              rank: data.participant.rank,
              correctAnswersCount: Number(data.participant.correct_answers_count),
              wrongAnswersCount: Number(data.participant.wrong_answers_count),
              unattemptedCount: Number(data.participant.unattempted_count),
              accuracyPercentage: Number(data.participant.accuracy_percentage),
              timeTakenSeconds: Number(data.participant.time_taken_seconds),
              xpAwarded: Number(data.participant.xp_awarded),
            }
          : undefined,
        questions,
      }
    } catch (err) {
      console.error('Error fetching contest review:', err)
      return { success: false, questions: [], error: 'NETWORK_ERROR' }
    }
  }
}
