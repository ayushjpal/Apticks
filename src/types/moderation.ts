export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed'

export type ReportReason =
  | 'question_errata'
  | 'question_clarity'
  | 'inappropriate_content'
  | 'cheating_suspicion'
  | 'technical_issue'
  | 'other'

export type TargetType = 'question' | 'contest' | 'user' | 'general'

export interface ReporterProfile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export interface ResolverProfile {
  id: string
  username: string | null
  display_name: string | null
}

export interface QuestionTargetContext {
  type: 'question'
  id: string
  title?: string
  prompt?: string
  category?: string
  topic?: string
  difficulty?: string
  is_active?: boolean
  missing?: boolean
}

export interface ContestTargetContext {
  type: 'contest'
  id: string
  slug?: string
  title?: string
  status?: string
  category?: string
  difficulty?: string
  missing?: boolean
}

export interface UserTargetContext {
  type: 'user'
  id: string
  username?: string
  display_name?: string
  role?: string
  created_at?: string
  missing?: boolean
}

export interface GeneralTargetContext {
  type: 'general'
  id: string
  missing?: boolean
}

export type TargetContext =
  | QuestionTargetContext
  | ContestTargetContext
  | UserTargetContext
  | GeneralTargetContext

export interface ModerationReport {
  id: string
  reporter_id: string
  target_type: TargetType
  target_id: string
  reason: ReportReason
  description: string
  status: ReportStatus
  moderator_notes: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
  reporter?: ReporterProfile
  resolver?: ResolverProfile | null
  target_context?: TargetContext | null
}

export interface ModerationMetrics {
  pending: number
  reviewing: number
  resolved: number
  dismissed: number
  total: number
}

export interface ModerationFilterParams {
  status?: ReportStatus | 'all'
  reason?: ReportReason | 'all'
  search?: string
  limit?: number
  offset?: number
}

export interface ModerationListResult {
  incidents: ModerationReport[]
  total: number
  limit: number
  offset: number
}

export const REASON_LABELS: Record<ReportReason, string> = {
  question_errata: 'Question Errata',
  question_clarity: 'Clarity / Wording',
  inappropriate_content: 'Inappropriate Content',
  cheating_suspicion: 'Cheating Suspicion',
  technical_issue: 'Technical Issue',
  other: 'General Inquiry',
}

export const TARGET_LABELS: Record<TargetType, string> = {
  question: 'Problem / Question',
  contest: 'Tournament / Contest',
  user: 'User Profile',
  general: 'Platform / Other',
}
