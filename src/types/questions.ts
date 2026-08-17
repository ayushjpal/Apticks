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
}

export interface QuestionFilters {
  searchQuery: string
  category: Category | 'all'
  topic: string | 'all'
  difficulty: Difficulty | 'all'
  status: 'all' | 'solved' | 'unsolved' | 'bookmarked'
}
