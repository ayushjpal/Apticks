// ==============================================================================
// MODULE 10 — PHASE 4: 1v1 MATCHMAKING & CHALLENGE TYPES
// File: src/types/match1v1.ts
// ==============================================================================

export type Match1v1Status =
  | 'pending'
  | 'waiting'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'abandoned'

export interface Match1v1Participant {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  level: number
  level_title: string
}

export interface Match1v1 {
  id: string
  status: Match1v1Status
  category: string
  question_count: number
  time_per_question_seconds: number
  started_at: string | null
  completed_at: string | null
  expires_at: string | null
  created_at: string
  is_caller_challenger: boolean
  challenger: Match1v1Participant
  opponent: Match1v1Participant
}

export interface Match1v1Question {
  question_id: string
  order_index: number
  title: string
  prompt: string
  category: string
  topic: string
  difficulty: string
  options: { id: string; text: string }[] | Record<string, string> | Record<string, unknown>
  points: number
}

export interface IncomingChallenge {
  id: string
  challenger_id: string
  category: string
  question_count: number
  time_per_question_seconds: number
  status: Match1v1Status
  created_at: string
  expires_at: string | null
  challenger: Match1v1Participant
}

export interface OutgoingChallenge {
  id: string
  opponent_id: string
  category: string
  question_count: number
  time_per_question_seconds: number
  status: Match1v1Status
  created_at: string
  expires_at: string | null
  opponent: Match1v1Participant
}

export interface ActiveMatchItem {
  id: string
  challenger_id: string
  opponent_id: string
  category: string
  question_count: number
  time_per_question_seconds: number
  status: Match1v1Status
  started_at: string | null
  created_at: string
  is_caller_challenger: boolean
  competitor: Match1v1Participant
}

export interface My1v1ChallengesResponse {
  incoming: IncomingChallenge[]
  outgoing: OutgoingChallenge[]
  active: ActiveMatchItem[]
}

export interface MatchmakingQueueResponse {
  success: boolean
  status: 'matched' | 'queued' | 'left'
  match_id?: string
  queue_id?: string
  message?: string
  error?: string
}

// ------------------------------------------------------------------------------
// PHASE 5: LIVE BATTLE & GAMEPLAY TYPES
// ------------------------------------------------------------------------------

export interface Match1v1AnswerRecord {
  question_id: string
  selected_option: string
  is_correct: boolean
  score_awarded: number
  time_spent_seconds: number
  submitted_at: string
}

export interface Match1v1ParticipantState {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  score: number
  answered_count: number
}

export interface Match1v1GameState {
  match_id: string
  status: Match1v1Status
  category: string
  question_count: number
  time_per_question_seconds: number
  total_duration_seconds: number
  started_at: string | null
  deadline: string | null
  remaining_seconds: number
  server_now: string
  completed_at: string | null
  winner_id: string | null
  is_draw: boolean
  is_caller_challenger: boolean
  challenger: Match1v1ParticipantState
  opponent: Match1v1ParticipantState
  caller_answers: Match1v1AnswerRecord[]
  opponent_answers: Match1v1AnswerRecord[]
  challenger_xp_awarded?: number | null
  opponent_xp_awarded?: number | null
  caller_xp_awarded?: number | null
}

export interface Submit1v1AnswerResponse {
  success: boolean
  is_correct?: boolean
  score_awarded?: number
  current_score?: number
  answered_count?: number
  total_questions?: number
  match_status?: Match1v1Status
  is_completed?: boolean
  error?: string
  message?: string
}

export interface Finalize1v1MatchResponse {
  success: boolean
  status?: Match1v1Status
  match_id?: string
  challenger_score?: number
  opponent_score?: number
  winner_id?: string | null
  is_draw?: boolean
  challenger_xp_awarded?: number
  opponent_xp_awarded?: number
  caller_xp_awarded?: number | null
  completed_at?: string
  error?: string
  message?: string
}
