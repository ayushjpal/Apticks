export type ContestDifficulty = 'easy' | 'medium' | 'hard' | 'open' | 'master'

export type ContestStatus = 'upcoming' | 'live' | 'completed' | 'cancelled'

export type ContestParticipantStatus =
  | 'registered'
  | 'in_progress'
  | 'completed'
  | 'disqualified'
  | 'abandoned'

export interface ContestOption {
  id: string
  text: string
}

export interface Contest {
  id: string
  title: string
  slug: string
  description: string | null
  category: string
  difficulty: ContestDifficulty
  status: ContestStatus
  startTime: string
  endTime: string
  durationMinutes: number
  totalQuestions: number
  totalMarks: number
  positiveMarksPerQuestion: number
  negativeMarksPerQuestion: number
  xpPool: number
  rules: string | null
  syllabus: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  // Client enrichment
  participantsCount?: number
  isRegistered?: boolean
  userStatus?: ContestParticipantStatus | null
}

export interface DatabaseContest {
  id: string
  title: string
  slug: string
  description: string | null
  category: string
  difficulty: string
  status: string
  start_time: string
  end_time: string
  duration_minutes: number
  total_questions: number
  total_marks: number
  positive_marks_per_question: number
  negative_marks_per_question: number
  xp_pool: number
  rules: string | null
  syllabus: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ContestQuestion {
  questionId: string
  orderIndex: number
  title: string
  prompt: string
  category: string
  topic: string
  difficulty: string
  options: ContestOption[]
  marks: number
  negativeMarks: number
}

export interface ContestSession {
  participantId: string
  status: ContestParticipantStatus
  startedAt: string
  durationMinutes: number
  timeRemainingSeconds: number
  serverTime: string
}

export interface ContestSubmissionAnswer {
  question_id: string
  selected_option: string | null
  time_spent_seconds?: number
}

export interface ContestSubmissionResult {
  success: boolean
  alreadySubmitted?: boolean
  totalScore: number
  correctAnswersCount: number
  wrongAnswersCount: number
  unattemptedCount: number
  accuracyPercentage: number
  timeTakenSeconds: number
  rank: number | null
  xpAwarded: number
  message: string
  error?: string
}

export interface ContestLeaderboardEntry {
  rank: number
  userId: string
  username: string
  displayName: string
  avatarUrl: string | null
  totalScore: number
  timeTakenSeconds: number
  correctAnswersCount: number
  accuracyPercentage: number
  xpAwarded: number
  submittedAt: string
}

export interface ContestReviewQuestion {
  questionId: string
  orderIndex: number
  title: string
  prompt: string
  category: string
  topic: string
  difficulty: string
  options: ContestOption[]
  selectedOption: string | null
  correctOption: string
  isCorrect: boolean
  marksAwarded: number
  timeSpentSeconds: number
  explanation: string
  formulaOrRule?: string | null
}

export interface UserContestStatus {
  found: boolean
  isAuthenticated: boolean
  isRegistered: boolean
  participantId?: string | null
  status?: ContestParticipantStatus | null
  startedAt?: string | null
  submittedAt?: string | null
  totalScore?: number | null
  rank?: number | null
  timeTakenSeconds?: number | null
  correctAnswersCount?: number | null
  wrongAnswersCount?: number | null
  unattemptedCount?: number | null
  accuracyPercentage?: number | null
  xpAwarded?: number | null
  timeRemainingSeconds?: number | null
  serverTime?: string
}
