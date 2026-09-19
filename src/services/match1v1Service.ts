// ==============================================================================
// MODULE 10 — PHASE 4: 1v1 MATCHMAKING & CHALLENGE SERVICE
// File: src/services/match1v1Service.ts
// ==============================================================================

import { supabase } from '../lib/supabase'
import type {
  Match1v1,
  Match1v1Question,
  My1v1ChallengesResponse,
  MatchmakingQueueResponse,
  Match1v1GameState,
  Submit1v1AnswerResponse,
  Finalize1v1MatchResponse,
} from '../types/match1v1'
import type { RealtimeChannel } from '@supabase/supabase-js'

export class Match1v1Service {
  /**
   * Issue a direct 1v1 challenge to a competitor
   */
  static async createChallenge(
    targetUserId: string,
    category: string = 'All Topics',
    questionCount: number = 5,
    timePerQuestionSeconds: number = 60
  ): Promise<{ success: boolean; match_id?: string; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('create_1v1_challenge', {
        p_target_user_id: targetUserId,
        p_category: category,
        p_question_count: questionCount,
        p_time_per_question_seconds: timePerQuestionSeconds,
      })

      if (error) {
        return { success: false, error: 'RPC_ERROR', message: error.message }
      }

      return data as { success: boolean; match_id?: string; message?: string; error?: string }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to issue challenge'
      return { success: false, error: 'CLIENT_ERROR', message }
    }
  }

  /**
   * Respond to an incoming 1v1 challenge (accept or decline)
   */
  static async respondToChallenge(
    matchId: string,
    action: 'accept' | 'decline'
  ): Promise<{ success: boolean; status?: string; match_id?: string; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('respond_1v1_challenge', {
        p_match_id: matchId,
        p_action: action,
      })

      if (error) {
        return { success: false, error: 'RPC_ERROR', message: error.message }
      }

      return data as { success: boolean; status?: string; match_id?: string; message?: string; error?: string }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to ${action} challenge`
      return { success: false, error: 'CLIENT_ERROR', message }
    }
  }

  /**
   * Cancel an outgoing waiting/pending 1v1 challenge
   */
  static async cancelChallenge(
    matchId: string
  ): Promise<{ success: boolean; status?: string; match_id?: string; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('cancel_1v1_challenge', {
        p_match_id: matchId,
      })

      if (error) {
        return { success: false, error: 'RPC_ERROR', message: error.message }
      }

      return data as { success: boolean; status?: string; match_id?: string; message?: string; error?: string }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel challenge'
      return { success: false, error: 'CLIENT_ERROR', message }
    }
  }

  /**
   * Start an accepted 1v1 match (transition to in_progress with server timestamp)
   */
  static async startMatch(
    matchId: string
  ): Promise<{ success: boolean; status?: string; match_id?: string; started_at?: string; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('start_1v1_match', {
        p_match_id: matchId,
      })

      if (error) {
        return { success: false, error: 'RPC_ERROR', message: error.message }
      }

      return data as {
        success: boolean
        status?: string
        match_id?: string
        started_at?: string
        message?: string
        error?: string
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start match'
      return { success: false, error: 'CLIENT_ERROR', message }
    }
  }

  /**
   * Join random matchmaking queue with atomic pairing
   */
  static async joinMatchmaking(
    category: string = 'All Topics',
    questionCount: number = 5,
    timePerQuestionSeconds: number = 60
  ): Promise<MatchmakingQueueResponse> {
    try {
      const { data, error } = await supabase.rpc('join_matchmaking_queue', {
        p_category: category,
        p_question_count: questionCount,
        p_time_per_question_seconds: timePerQuestionSeconds,
      })

      if (error) {
        return { success: false, status: 'left', error: 'RPC_ERROR', message: error.message }
      }

      return data as MatchmakingQueueResponse
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join matchmaking'
      return { success: false, status: 'left', error: 'CLIENT_ERROR', message }
    }
  }

  /**
   * Leave matchmaking queue
   */
  static async leaveMatchmaking(): Promise<{ success: boolean; status: string; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('leave_matchmaking_queue')

      if (error) {
        return { success: false, status: 'error', message: error.message }
      }

      return data as { success: boolean; status: string; message?: string }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to leave matchmaking'
      return { success: false, status: 'error', message }
    }
  }

  /**
   * Retrieve match metadata and participants (Zero-leak: no answers, no solutions)
   */
  static async getMatch(
    matchId: string
  ): Promise<{ success: boolean; match?: Match1v1; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_1v1_match', {
        p_match_id: matchId,
      })

      if (error) {
        return { success: false, error: 'RPC_ERROR', message: error.message }
      }

      return data as { success: boolean; match?: Match1v1; message?: string; error?: string }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch match'
      return { success: false, error: 'CLIENT_ERROR', message }
    }
  }

  /**
   * Retrieve ordered questions for accepted/in_progress match
   * STRICT ANTI-CHEAT: Strips correct_option, explanation, and solution keys
   */
  static async getMatchQuestions(
    matchId: string
  ): Promise<{ success: boolean; questions?: Match1v1Question[]; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_1v1_match_questions', {
        p_match_id: matchId,
      })

      if (error) {
        return { success: false, error: 'RPC_ERROR', message: error.message }
      }

      return data as { success: boolean; questions?: Match1v1Question[]; message?: string; error?: string }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch match questions'
      return { success: false, error: 'CLIENT_ERROR', message }
    }
  }

  /**
   * Fetch current user's incoming challenges, outgoing challenges, and active matches
   */
  static async getMyChallenges(
    limit: number = 20,
    offset: number = 0
  ): Promise<{ success: boolean; data?: My1v1ChallengesResponse; message?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_my_1v1_challenges', {
        p_limit: limit,
        p_offset: offset,
      })

      if (error) {
        return { success: false, message: error.message }
      }

      const res = data as {
        success: boolean
        incoming: My1v1ChallengesResponse['incoming']
        outgoing: My1v1ChallengesResponse['outgoing']
        active: My1v1ChallengesResponse['active']
      }

      return {
        success: true,
        data: {
          incoming: res.incoming || [],
          outgoing: res.outgoing || [],
          active: res.active || [],
        },
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch challenges'
      return { success: false, message }
    }
  }

  /**
   * Subscribe to real-time status updates on a specific match
   */
  static subscribeToMatch(
    matchId: string,
    onUpdate: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void
  ): RealtimeChannel {
    return supabase
      .channel(`match_1v1_${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches_1v1',
          filter: `id=eq.${matchId}`,
        },
        (payload) => {
          onUpdate(payload as unknown as { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> })
        }
      )
      .subscribe()
  }

  /**
   * Subscribe to user's challenge events via notifications channel
   */
  static subscribeToUserChallenges(
    userId: string,
    onNotification: (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void
  ): RealtimeChannel {
    return supabase
      .channel(`user_notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onNotification(payload as unknown as { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> })
        }
      )
      .subscribe()
  }

  // ============================================================================
  // PHASE 5: LIVE BATTLE & GAMEPLAY METHODS
  // ============================================================================

  /**
   * Submit an answer to a question in a 1v1 battle
   * Server validates answer correctness, calculates points, enforces timer, and returns safe result
   */
  static async submitAnswer(
    matchId: string,
    questionId: string,
    selectedOption: string,
    timeSpentSeconds: number = 0
  ): Promise<Submit1v1AnswerResponse> {
    try {
      const { data, error } = await supabase.rpc('submit_1v1_answer', {
        p_match_id: matchId,
        p_question_id: questionId,
        p_selected_option: selectedOption,
        p_time_spent_seconds: timeSpentSeconds,
      })

      if (error) {
        return { success: false, error: 'RPC_ERROR', message: error.message }
      }

      return data as Submit1v1AnswerResponse
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit answer'
      return { success: false, error: 'CLIENT_ERROR', message }
    }
  }

  /**
   * Finalize a 1v1 battle (idempotent, server-authoritative scoring & winner calculation)
   */
  static async finalizeMatch(matchId: string): Promise<Finalize1v1MatchResponse> {
    try {
      const { data, error } = await supabase.rpc('finalize_1v1_match', {
        p_match_id: matchId,
      })

      if (error) {
        return { success: false, error: 'RPC_ERROR', message: error.message }
      }

      return data as Finalize1v1MatchResponse
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to finalize match'
      return { success: false, error: 'CLIENT_ERROR', message }
    }
  }

  /**
   * Fetch complete, authoritative, zero-leak game state for battle arena and reconnect recovery
   */
  static async getGameState(
    matchId: string
  ): Promise<{ success: boolean; state?: Match1v1GameState; message?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('get_1v1_game_state', {
        p_match_id: matchId,
      })

      if (error) {
        return { success: false, error: 'RPC_ERROR', message: error.message }
      }

      const res = data as { success: boolean; state?: Match1v1GameState; message?: string; error?: string }
      return res
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch game state'
      return { success: false, error: 'CLIENT_ERROR', message }
    }
  }
}
