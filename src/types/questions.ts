export type Category =
  | 'Quantitative Aptitude'
  | 'Logical Reasoning'
  | 'Data Interpretation'
  | 'Verbal & Abstract'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface QuestionOption {
  id: string // 'A' | 'B' | 'C' | 'D'
  text: string
}

export interface Question {
  id: string
  category: Category
  topic: string
  title: string
  prompt: string
  options: QuestionOption[]
  correctOption: string // e.g. 'B'
  explanation: string
  formulaOrRule?: string
  hints: string[]
  difficulty: Difficulty
  points: number
  acceptanceRate?: number
  tags: string[]
}

export interface UserQuestionProgress {
  questionId: string
  isSolved: boolean
  isCorrect: boolean
  isBookmarked: boolean
  selectedOption?: string
  attemptsCount: number
  timeSpentSeconds: number
  lastAttemptedAt: string
}

export interface UserQuestionAttempt {
  id: string
  userId: string
  questionId: string
  selectedOption: string
  isCorrect: boolean
  xpChange: number
  attemptNumber: number
  timeSpentSeconds: number
  createdAt: string
  questionTitle?: string
  questionCategory?: string
  questionDifficulty?: Difficulty
}

export interface QuestionBankStats {
  totalQuestions: number
  solvedCount: number
  easySolved: number
  easyTotal: number
  mediumSolved: number
  mediumTotal: number
  hardSolved: number
  hardTotal: number
  bookmarkedCount: number
  accuracyRate: number
  totalPoints: number
  // Competitive Progression Metrics
  totalAttempts: number
  correctAttempts: number
  incorrectAttempts: number
  xpEarned: number
  xpLost: number
  netXp: number
  challengeBonusXp?: number
  contestXp?: number
  authoritativeTotalXp?: number
}

export interface QuestionFilters {
  searchQuery: string
  category: Category | 'all'
  topic: string | 'all'
  difficulty: Difficulty | 'all'
  status: 'all' | 'solved' | 'unsolved' | 'bookmarked'
}

export interface DatabaseQuestion {
  id: string
  title: string
  prompt: string
  category: string
  topic: string
  difficulty: string
  options: QuestionOption[] | string
  correct_option: string
  explanation: string
  formula_or_rule?: string | null
  hints?: string[] | string | null
  points?: number | null
  acceptance_rate?: number | null
  tags?: string[] | string | null
  is_active?: boolean | null
  created_at?: string | null
  updated_at?: string | null
}

// =============================================================================
// MODULE 3: DAILY STREAKS & DAILY CHALLENGES TYPES
// =============================================================================

export interface UserStreak {
  currentStreak: number
  longestStreak: number
  isActiveToday: boolean
  isAtRisk: boolean
  lastActiveDate: string | null
}

export interface DailyChallenge {
  challengeId: string
  challengeDate: string
  bonusXp: number
  isCompleted: boolean
  bonusXpAwarded?: number
  completedAt?: string | null
  secondsLeft: number
  question: Question
}

export interface DailyChallengeSubmissionResult {
  success: boolean
  isCorrect: boolean
  correctOption?: string
  explanation?: string
  bonusXp: number
  questionXp?: number
  xpChange?: number
  alreadyCompleted: boolean
  streak?: number
  longestStreak?: number
  message: string
  error?: string
}
