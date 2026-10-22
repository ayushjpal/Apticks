-- ==============================================================================
-- MODULE 10 — PHASE 7: 1V1 LEAVE MATCH & FORFEIT ENGINE
-- File: supabase/migrations/MODULE_10_PHASE_7_1V1_LEAVE_AND_FORFEIT.sql
-- ==============================================================================
-- Scope:
--   1. Schema: Add `forfeited_by` UUID column to public.matches_1v1
--   2. RPC: leave_1v1_match(p_match_id UUID)
--      - Pre-match (pending, waiting, accepted): Cancel match with 0 XP deduction
--      - Active match (in_progress): Atomic forfeit, -50 XP penalty (never below 0),
--        opponent wins by forfeit (+50 XP), real-time notification dispatch,
--        idempotent protection against duplicate penalties.
--   3. RPC update: submit_1v1_answer - Block answers if match has been forfeited
--   4. RPC update: finalize_1v1_match - Include forfeited_by in result payload
--   5. RPC update: get_1v1_game_state - Include forfeited_by in state payload
--   6. RPC update: get_global_leaderboard & get_user_global_rank -
--      Incorporate match penalties into match_xp calculation while preserving GREATEST(0, total_xp)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA EXTENSION: public.matches_1v1.forfeited_by
-- ------------------------------------------------------------------------------
ALTER TABLE public.matches_1v1 
ADD COLUMN IF NOT EXISTS forfeited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_matches_1v1_forfeited_by 
ON public.matches_1v1(forfeited_by) 
WHERE forfeited_by IS NOT NULL;

-- Ensure notifications table allows match_cancelled
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'friend_request',
  'friend_accepted',
  'challenge_received',
  'challenge_accepted',
  'challenge_declined',
  'match_ready',
  'match_completed',
  'match_cancelled',
  'new_follower',
  'system_alert'
));

-- Ensure replica identity full for complete realtime update payloads
ALTER TABLE public.matches_1v1 REPLICA IDENTITY FULL;


-- ------------------------------------------------------------------------------
-- 2. RPC: leave_1v1_match
-- Atomic server-side operation for leaving/cancelling or forfeiting a match
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_1v1_match(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
  v_opponent_id UUID;
  v_c_score NUMERIC(6,2);
  v_o_score NUMERIC(6,2);
  v_c_time INTEGER;
  v_o_time INTEGER;
  v_forfeit_penalty INTEGER := 50;
  v_c_xp INTEGER := 0;
  v_o_xp INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Authentication Check
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  -- 2. Concurrency Control: Lock match row FOR UPDATE to prevent race conditions & duplicate penalties
  SELECT * INTO v_match
  FROM public.matches_1v1
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_FOUND', 'message', 'Match not found.');
  END IF;

  -- 3. Authorization Check: Caller MUST be a participant
  IF v_match.challenger_id <> v_caller_id AND v_match.opponent_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_PARTICIPANT', 'message', 'Only match participants can leave or forfeit this match.');
  END IF;

  v_opponent_id := CASE WHEN v_caller_id = v_match.challenger_id THEN v_match.opponent_id ELSE v_match.challenger_id END;

  -- 4. Idempotency: If match is already completed, return existing final state with NO repeated deduction
  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'completed',
      'match_id', p_match_id,
      'winner_id', v_match.winner_id,
      'forfeited_by', v_match.forfeited_by,
      'xp_deducted', 0,
      'caller_xp_awarded', CASE 
        WHEN v_caller_id = v_match.challenger_id THEN v_match.challenger_xp_awarded 
        ELSE v_match.opponent_xp_awarded 
      END,
      'message', 'Match is already completed.'
    );
  END IF;

  -- If match was already cancelled, declined, or abandoned
  IF v_match.status IN ('declined', 'cancelled', 'abandoned') THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', v_match.status,
      'match_id', p_match_id,
      'xp_deducted', 0,
      'message', 'Match has already ended.'
    );
  END IF;

  -- 5. Leaving BEFORE Match Starts (pending, waiting, accepted) -> No XP deduction
  IF v_match.status IN ('pending', 'waiting', 'accepted') THEN
    UPDATE public.matches_1v1
    SET status = 'cancelled',
        updated_at = v_now
    WHERE id = p_match_id;

    -- Also clean caller from matchmaking queue if present
    DELETE FROM public.matchmaking_queue
    WHERE user_id = v_caller_id;

    -- Notify the other participant that the match was cancelled (if opponent exists)
    IF v_opponent_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        actor_id,
        type,
        title,
        message,
        data
      ) VALUES (
        v_opponent_id,
        v_caller_id,
        'match_cancelled',
        'Match Cancelled',
        'Your opponent left the lobby before the match started.',
        jsonb_build_object('match_id', p_match_id)
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'cancelled',
      'match_id', p_match_id,
      'xp_deducted', 0,
      'message', 'Match cancelled before starting. No XP deducted.'
    );
  END IF;

  -- 6. Leaving Active Match (in_progress) -> Forfeit & Deduct Configurable XP (-50 XP)
  IF v_match.status = 'in_progress' THEN
    -- Calculate authoritative scores at the moment of forfeit from match_1v1_answers
    SELECT COALESCE(SUM(score_awarded), 0.00), COALESCE(SUM(time_spent_seconds), 0)
    INTO v_c_score, v_c_time
    FROM public.match_1v1_answers
    WHERE match_id = p_match_id AND user_id = v_match.challenger_id;

    SELECT COALESCE(SUM(score_awarded), 0.00), COALESCE(SUM(time_spent_seconds), 0)
    INTO v_o_score, v_o_time
    FROM public.match_1v1_answers
    WHERE match_id = p_match_id AND user_id = v_match.opponent_id;

    -- Assign XP: Forfeiting player gets -50 XP penalty; opponent gets +50 XP forfeit win
    IF v_caller_id = v_match.challenger_id THEN
      v_c_xp := -v_forfeit_penalty;
      v_o_xp := 50;
    ELSE
      v_c_xp := 50;
      v_o_xp := -v_forfeit_penalty;
    END IF;

    -- Atomically finalize match state
    UPDATE public.matches_1v1
    SET status = 'completed',
        challenger_score = v_c_score,
        opponent_score = v_o_score,
        challenger_time_taken = v_c_time,
        opponent_time_taken = v_o_time,
        winner_id = v_opponent_id,
        is_draw = FALSE,
        challenger_xp_awarded = v_c_xp,
        opponent_xp_awarded = v_o_xp,
        forfeited_by = v_caller_id,
        completed_at = v_now,
        updated_at = v_now
    WHERE id = p_match_id;

    -- Insert in-app notifications
    INSERT INTO public.notifications (
      user_id,
      actor_id,
      type,
      title,
      message,
      data
    ) VALUES
    (
      v_opponent_id,
      v_caller_id,
      'match_completed',
      'Opponent Forfeited',
      'Your opponent left the 1v1 battle. Victory by forfeit! (+50 XP)',
      jsonb_build_object(
        'match_id', p_match_id,
        'winner_id', v_opponent_id,
        'forfeited_by', v_caller_id,
        'xp_awarded', 50
      )
    ),
    (
      v_caller_id,
      v_opponent_id,
      'match_completed',
      '1v1 Battle Forfeited',
      'You left the 1v1 battle. (-50 XP penalty applied)',
      jsonb_build_object(
        'match_id', p_match_id,
        'winner_id', v_opponent_id,
        'forfeited_by', v_caller_id,
        'xp_awarded', -v_forfeit_penalty
      )
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'completed',
      'match_id', p_match_id,
      'winner_id', v_opponent_id,
      'forfeited_by', v_caller_id,
      'xp_deducted', v_forfeit_penalty,
      'caller_xp_awarded', -v_forfeit_penalty,
      'message', 'You forfeited the match. 50 XP penalty applied.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', false,
    'error', 'INVALID_STATE',
    'message', 'Cannot leave match in state: ' || v_match.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leave_1v1_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_1v1_match(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. UPDATE RPC: submit_1v1_answer (Anti-cheat & forfeit enforcement)
-- Block answers if match has already been completed or forfeited
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_1v1_answer(
  p_match_id UUID,
  p_question_id TEXT,
  p_selected_option TEXT,
  p_time_spent_seconds INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
  v_q_order INTEGER;
  v_correct_option TEXT;
  v_q_points INTEGER;
  v_is_correct BOOLEAN;
  v_points_awarded NUMERIC(6,2);
  v_total_duration_secs INTEGER;
  v_deadline TIMESTAMPTZ;
  v_authoritative_elapsed INTEGER;
  v_safe_time_spent INTEGER;
  v_caller_answered_count INTEGER;
  v_opponent_answered_count INTEGER;
  v_new_caller_score NUMERIC(6,2);
  v_is_match_completed BOOLEAN := FALSE;
BEGIN
  -- 1. Verify caller authentication
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  -- 2. Lock match row for concurrency safety
  SELECT * INTO v_match
  FROM public.matches_1v1
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_FOUND', 'message', 'Match not found.');
  END IF;

  -- 3. Verify caller is a match participant
  IF v_match.challenger_id <> v_caller_id AND v_match.opponent_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_PARTICIPANT', 'message', 'You are not a participant in this match.');
  END IF;

  -- 4. Verify match is currently active / in_progress and not forfeited
  IF v_match.forfeited_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_FORFEITED', 'message', 'This match was ended due to forfeit.');
  END IF;

  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_ALREADY_COMPLETED', 'message', 'Match is already completed.');
  END IF;

  IF v_match.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_IN_PROGRESS', 'message', 'Match is not in progress.');
  END IF;

  -- 5. Server-Authoritative Deadline Check
  v_total_duration_secs := v_match.question_count * v_match.time_per_question_seconds;
  v_deadline := v_match.started_at + (v_total_duration_secs * INTERVAL '1 second');

  IF NOW() > v_deadline + INTERVAL '5 seconds' THEN
    PERFORM public.finalize_1v1_match(p_match_id);
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DEADLINE_EXCEEDED',
      'message', 'Match timer has expired.',
      'match_status', 'completed'
    );
  END IF;

  -- 6. Verify question belongs to this match
  SELECT mq.order_index, q.correct_option, q.points
  INTO v_q_order, v_correct_option, v_q_points
  FROM public.match_1v1_questions mq
  JOIN public.questions q ON q.id = mq.question_id
  WHERE mq.match_id = p_match_id
    AND mq.question_id = p_question_id;

  IF v_correct_option IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_QUESTION', 'message', 'Question does not belong to this battle.');
  END IF;

  -- 7. Check if caller has already answered this question
  IF EXISTS (
    SELECT 1 FROM public.match_1v1_answers
    WHERE match_id = p_match_id
      AND user_id = v_caller_id
      AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ANSWERED', 'message', 'You have already answered this question.');
  END IF;

  -- 8. Server-Authoritative Evaluation & Scoring
  v_is_correct := (TRIM(LOWER(p_selected_option)) = TRIM(LOWER(v_correct_option)));
  v_points_awarded := CASE WHEN v_is_correct THEN COALESCE(v_q_points, 10)::numeric ELSE 0.00 END;

  v_authoritative_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - v_match.started_at))::integer);
  v_safe_time_spent := GREATEST(0, LEAST(COALESCE(p_time_spent_seconds, 0), v_authoritative_elapsed));

  -- 9. Insert answer into match_1v1_answers
  BEGIN
    INSERT INTO public.match_1v1_answers (
      match_id,
      user_id,
      question_id,
      selected_option,
      is_correct,
      score_awarded,
      time_spent_seconds,
      submitted_at
    ) VALUES (
      p_match_id,
      v_caller_id,
      p_question_id,
      p_selected_option,
      v_is_correct,
      v_points_awarded,
      v_safe_time_spent,
      NOW()
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_ANSWERED', 'message', 'Concurrent duplicate submission blocked.');
  END;

  -- 10. Update running score and time on matches_1v1
  IF v_caller_id = v_match.challenger_id THEN
    UPDATE public.matches_1v1
    SET challenger_score = challenger_score + v_points_awarded,
        challenger_time_taken = challenger_time_taken + v_safe_time_spent,
        updated_at = NOW()
    WHERE id = p_match_id
    RETURNING challenger_score INTO v_new_caller_score;
  ELSE
    UPDATE public.matches_1v1
    SET opponent_score = opponent_score + v_points_awarded,
        opponent_time_taken = opponent_time_taken + v_safe_time_spent,
        updated_at = NOW()
    WHERE id = p_match_id
    RETURNING opponent_score INTO v_new_caller_score;
  END IF;

  -- 11. Count progress
  SELECT COUNT(*) INTO v_caller_answered_count
  FROM public.match_1v1_answers
  WHERE match_id = p_match_id AND user_id = v_caller_id;

  SELECT COUNT(*) INTO v_opponent_answered_count
  FROM public.match_1v1_answers
  WHERE match_id = p_match_id
    AND user_id = CASE WHEN v_caller_id = v_match.challenger_id THEN v_match.opponent_id ELSE v_match.challenger_id END;

  -- 12. If both finished all questions, automatically finalize
  IF v_caller_answered_count >= v_match.question_count AND v_opponent_answered_count >= v_match.question_count THEN
    PERFORM public.finalize_1v1_match(p_match_id);
    v_is_match_completed := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_correct', v_is_correct,
    'score_awarded', v_points_awarded,
    'current_score', v_new_caller_score,
    'answered_count', v_caller_answered_count,
    'total_questions', v_match.question_count,
    'match_status', CASE WHEN v_is_match_completed THEN 'completed' ELSE 'in_progress' END,
    'is_completed', v_is_match_completed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_1v1_answer(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_1v1_answer(UUID, TEXT, TEXT, INTEGER) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. UPDATE RPC: finalize_1v1_match (Include forfeited_by)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_1v1_match(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
  v_c_score NUMERIC(6,2);
  v_o_score NUMERIC(6,2);
  v_c_time INTEGER;
  v_o_time INTEGER;
  v_winner_id UUID := NULL;
  v_is_draw BOOLEAN := FALSE;
  v_c_xp INTEGER := 0;
  v_o_xp INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Lock match row to prevent race conditions & duplicate finalization
  SELECT * INTO v_match
  FROM public.matches_1v1
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_FOUND', 'message', 'Match not found.');
  END IF;

  -- 2. Idempotency: If already completed, return existing final result with persisted XP and forfeit metadata
  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'completed',
      'match_id', p_match_id,
      'challenger_score', v_match.challenger_score,
      'opponent_score', v_match.opponent_score,
      'winner_id', v_match.winner_id,
      'is_draw', v_match.is_draw,
      'forfeited_by', v_match.forfeited_by,
      'challenger_xp_awarded', v_match.challenger_xp_awarded,
      'opponent_xp_awarded', v_match.opponent_xp_awarded,
      'caller_xp_awarded', CASE 
        WHEN v_caller_id = v_match.challenger_id THEN v_match.challenger_xp_awarded
        WHEN v_caller_id = v_match.opponent_id THEN v_match.opponent_xp_awarded
        ELSE NULL
      END,
      'completed_at', v_match.completed_at,
      'message', 'Match is already completed.'
    );
  END IF;

  -- 3. Validate caller authorization (must be participant or service_role)
  IF v_caller_id IS NOT NULL AND v_match.challenger_id <> v_caller_id AND v_match.opponent_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Only match participants can request finalization.');
  END IF;

  -- 4. Calculate final scores directly from authoritative match_1v1_answers table
  SELECT COALESCE(SUM(score_awarded), 0.00), COALESCE(SUM(time_spent_seconds), 0)
  INTO v_c_score, v_c_time
  FROM public.match_1v1_answers
  WHERE match_id = p_match_id AND user_id = v_match.challenger_id;

  SELECT COALESCE(SUM(score_awarded), 0.00), COALESCE(SUM(time_spent_seconds), 0)
  INTO v_o_score, v_o_time
  FROM public.match_1v1_answers
  WHERE match_id = p_match_id AND user_id = v_match.opponent_id;

  -- 5. Determine Winner / Loser / Draw & Fixed Authoritative XP
  IF v_c_score > v_o_score THEN
    v_winner_id := v_match.challenger_id;
    v_is_draw := FALSE;
    v_c_xp := 50;
    v_o_xp := 5;
  ELSIF v_o_score > v_c_score THEN
    v_winner_id := v_match.opponent_id;
    v_is_draw := FALSE;
    v_c_xp := 5;
    v_o_xp := 50;
  ELSE
    v_winner_id := NULL;
    v_is_draw := TRUE;
    v_c_xp := 20;
    v_o_xp := 20;
  END IF;

  -- 6. Atomically persist final match state and awarded XP
  UPDATE public.matches_1v1
  SET status = 'completed',
      challenger_score = v_c_score,
      opponent_score = v_o_score,
      challenger_time_taken = v_c_time,
      opponent_time_taken = v_o_time,
      winner_id = v_winner_id,
      is_draw = v_is_draw,
      challenger_xp_awarded = v_c_xp,
      opponent_xp_awarded = v_o_xp,
      completed_at = v_now,
      updated_at = v_now
  WHERE id = p_match_id;

  -- 7. Dispatch in-app notifications
  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    title,
    message,
    data
  ) VALUES
  (
    v_match.challenger_id,
    v_match.opponent_id,
    'match_completed',
    '1v1 Battle Concluded',
    CASE
      WHEN v_is_draw THEN 'Your 1v1 battle ended in a draw! (+20 XP)'
      WHEN v_winner_id = v_match.challenger_id THEN 'Victory! You won the 1v1 battle! (+50 XP)'
      ELSE 'The 1v1 battle has concluded. (+5 XP)'
    END,
    jsonb_build_object(
      'match_id', p_match_id,
      'challenger_score', v_c_score,
      'opponent_score', v_o_score,
      'winner_id', v_winner_id,
      'is_draw', v_is_draw,
      'xp_awarded', v_c_xp
    )
  ),
  (
    v_match.opponent_id,
    v_match.challenger_id,
    'match_completed',
    '1v1 Battle Concluded',
    CASE
      WHEN v_is_draw THEN 'Your 1v1 battle ended in a draw! (+20 XP)'
      WHEN v_winner_id = v_match.opponent_id THEN 'Victory! You won the 1v1 battle! (+50 XP)'
      ELSE 'The 1v1 battle has concluded. (+5 XP)'
    END,
    jsonb_build_object(
      'match_id', p_match_id,
      'challenger_score', v_c_score,
      'opponent_score', v_o_score,
      'winner_id', v_winner_id,
      'is_draw', v_is_draw,
      'xp_awarded', v_o_xp
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'match_id', p_match_id,
    'challenger_score', v_c_score,
    'opponent_score', v_o_score,
    'winner_id', v_winner_id,
    'is_draw', v_is_draw,
    'forfeited_by', NULL,
    'challenger_xp_awarded', v_c_xp,
    'opponent_xp_awarded', v_o_xp,
    'caller_xp_awarded', CASE 
      WHEN v_caller_id = v_match.challenger_id THEN v_c_xp
      WHEN v_caller_id = v_match.opponent_id THEN v_o_xp
      ELSE NULL
    END,
    'completed_at', v_now,
    'message', 'Match finalized successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_1v1_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_1v1_match(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. UPDATE RPC: get_1v1_game_state (Include forfeited_by)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_1v1_game_state(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
  v_challenger RECORD;
  v_opponent RECORD;
  v_total_duration_secs INTEGER;
  v_deadline TIMESTAMPTZ;
  v_remaining_secs INTEGER;
  v_caller_answers JSONB;
  v_opponent_answers JSONB := '[]'::jsonb;
  v_caller_ans_count INTEGER;
  v_opponent_ans_count INTEGER;
  v_is_caller_challenger BOOLEAN;
  v_is_completed BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  -- 1. Fetch match row
  SELECT * INTO v_match
  FROM public.matches_1v1
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_FOUND', 'message', 'Match not found.');
  END IF;

  -- 2. Validate participant authorization
  IF v_match.challenger_id <> v_caller_id AND v_match.opponent_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_PARTICIPANT', 'message', 'You do not have access to this battle.');
  END IF;

  v_is_caller_challenger := (v_match.challenger_id = v_caller_id);
  v_is_completed := (v_match.status = 'completed');

  -- 3. Calculate Authoritative Timer & Deadline
  v_total_duration_secs := v_match.question_count * v_match.time_per_question_seconds;
  IF v_match.started_at IS NOT NULL THEN
    v_deadline := v_match.started_at + (v_total_duration_secs * INTERVAL '1 second');
    v_remaining_secs := GREATEST(0, EXTRACT(EPOCH FROM (v_deadline - NOW()))::integer);
  ELSE
    v_deadline := NULL;
    v_remaining_secs := v_total_duration_secs;
  END IF;

  -- 4. Fetch Challenger Profile
  SELECT id, username, display_name, avatar_url
  INTO v_challenger
  FROM public.profiles
  WHERE id = v_match.challenger_id;

  -- 5. Fetch Opponent Profile
  SELECT id, username, display_name, avatar_url
  INTO v_opponent
  FROM public.profiles
  WHERE id = v_match.opponent_id;

  -- 6. Fetch Caller Answers (Safe for caller to view own answers)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'question_id', a.question_id,
        'selected_option', a.selected_option,
        'is_correct', a.is_correct,
        'score_awarded', a.score_awarded,
        'time_spent_seconds', a.time_spent_seconds,
        'submitted_at', a.submitted_at
      ) ORDER BY a.submitted_at ASC
    ),
    '[]'::jsonb
  ) INTO v_caller_answers
  FROM public.match_1v1_answers a
  WHERE a.match_id = p_match_id AND a.user_id = v_caller_id;

  SELECT COUNT(*) INTO v_caller_ans_count
  FROM public.match_1v1_answers
  WHERE match_id = p_match_id AND user_id = v_caller_id;

  SELECT COUNT(*) INTO v_opponent_ans_count
  FROM public.match_1v1_answers
  WHERE match_id = p_match_id
    AND user_id = CASE WHEN v_is_caller_challenger THEN v_match.opponent_id ELSE v_match.challenger_id END;

  -- 7. Fetch Opponent Answers ONLY IF MATCH IS COMPLETED
  IF v_is_completed THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'question_id', a.question_id,
          'selected_option', a.selected_option,
          'is_correct', a.is_correct,
          'score_awarded', a.score_awarded,
          'time_spent_seconds', a.time_spent_seconds,
          'submitted_at', a.submitted_at
        ) ORDER BY a.submitted_at ASC
      ),
      '[]'::jsonb
    ) INTO v_opponent_answers
    FROM public.match_1v1_answers a
    WHERE a.match_id = p_match_id
      AND a.user_id = CASE WHEN v_is_caller_challenger THEN v_match.opponent_id ELSE v_match.challenger_id END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'state', jsonb_build_object(
      'match_id', v_match.id,
      'status', v_match.status,
      'category', v_match.category,
      'question_count', v_match.question_count,
      'time_per_question_seconds', v_match.time_per_question_seconds,
      'total_duration_seconds', v_total_duration_secs,
      'started_at', v_match.started_at,
      'deadline', v_deadline,
      'remaining_seconds', v_remaining_secs,
      'server_now', NOW(),
      'completed_at', v_match.completed_at,
      'winner_id', v_match.winner_id,
      'is_draw', v_match.is_draw,
      'forfeited_by', v_match.forfeited_by,
      'is_caller_challenger', v_is_caller_challenger,
      -- XP Awarded exposed ONLY if completed
      'challenger_xp_awarded', CASE WHEN v_is_completed THEN v_match.challenger_xp_awarded ELSE NULL END,
      'opponent_xp_awarded', CASE WHEN v_is_completed THEN v_match.opponent_xp_awarded ELSE NULL END,
      'caller_xp_awarded', CASE 
        WHEN v_is_completed THEN 
          CASE WHEN v_is_caller_challenger THEN v_match.challenger_xp_awarded ELSE v_match.opponent_xp_awarded END
        ELSE NULL 
      END,
      'challenger', jsonb_build_object(
        'id', v_challenger.id,
        'username', v_challenger.username,
        'display_name', v_challenger.display_name,
        'avatar_url', v_challenger.avatar_url,
        'score', v_match.challenger_score,
        'answered_count', CASE WHEN v_is_caller_challenger THEN v_caller_ans_count ELSE v_opponent_ans_count END
      ),
      'opponent', jsonb_build_object(
        'id', v_opponent.id,
        'username', v_opponent.username,
        'display_name', v_opponent.display_name,
        'avatar_url', v_opponent.avatar_url,
        'score', v_match.opponent_score,
        'answered_count', CASE WHEN v_is_caller_challenger THEN v_opponent_ans_count ELSE v_caller_ans_count END
      ),
      'caller_answers', v_caller_answers,
      'opponent_answers', v_opponent_answers
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_1v1_game_state(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_1v1_game_state(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. UPDATE RPC: get_user_total_xp
-- Canonical unified total XP including Practice, Daily, Contest, and 1v1 Matches (including forfeit penalties)
-- Clamped to GREATEST(0, ...)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_total_xp(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT GREATEST(0::bigint,
    COALESCE((SELECT SUM(xp_change) FROM public.user_question_attempts WHERE user_id = p_user_id), 0::bigint) +
    COALESCE((SELECT SUM(bonus_xp_awarded) FROM public.user_daily_challenge_completions WHERE user_id = p_user_id), 0::bigint) +
    COALESCE((SELECT SUM(xp_awarded) FROM public.contest_participants WHERE user_id = p_user_id AND status = 'completed'), 0::bigint) +
    COALESCE((
      SELECT SUM(
        CASE
          WHEN challenger_id = p_user_id THEN challenger_xp_awarded
          WHEN opponent_id = p_user_id THEN opponent_xp_awarded
          ELSE 0
        END
      )
      FROM public.matches_1v1
      WHERE status = 'completed' AND (challenger_id = p_user_id OR opponent_id = p_user_id)
    ), 0::bigint)
  );
$$;

REVOKE ALL ON FUNCTION public.get_user_total_xp(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_total_xp(UUID) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 7. UPDATE LEADERBOARDS & RANKINGS: Account for negative match XP penalties
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_global_leaderboard(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset INTEGER := GREATEST(COALESCE(p_offset, 0), 0);
  v_total_count INTEGER := 0;
  v_leaderboard JSONB;
BEGIN
  SELECT COUNT(*) INTO v_total_count
  FROM public.profiles
  WHERE username IS NOT NULL
    AND username NOT IN (
      'm3xpcheck99914',
      'm3xpcheck240836',
      'verify_xp_agg_85278',
      'verify_xp_agg_21673',
      'verify_xp_agg_57053',
      'm3testa44019',
      'm3testb52410',
      'regress_21448',
      'regress_18854',
      'regress_45535',
      'testu97603',
      'ctest_75447',
      'lifecycle_44494',
      'test_student_76469',
      'test_student_68411',
      'test_student_23043'
    );

  WITH practice_stats AS (
    SELECT 
      user_id,
      COALESCE(SUM(xp_change), 0) AS practice_net_xp,
      COUNT(DISTINCT question_id) FILTER (WHERE is_correct = TRUE) AS solved_count,
      COUNT(id) AS total_attempts,
      COUNT(id) FILTER (WHERE is_correct = TRUE) AS correct_attempts
    FROM public.user_question_attempts
    GROUP BY user_id
  ),
  challenge_stats AS (
    SELECT 
      user_id,
      COALESCE(SUM(bonus_xp_awarded), 0) AS challenge_bonus_xp
    FROM public.user_daily_challenge_completions
    GROUP BY user_id
  ),
  contest_stats AS (
    SELECT 
      user_id,
      COALESCE(SUM(xp_awarded), 0) AS contest_xp,
      COUNT(id) AS contests_count
    FROM public.contest_participants
    WHERE status = 'completed'
    GROUP BY user_id
  ),
  match_stats AS (
    SELECT 
      user_id,
      COALESCE(SUM(xp), 0) AS match_xp,
      COUNT(DISTINCT match_id) AS matches_count
    FROM (
      SELECT id AS match_id, challenger_id AS user_id, challenger_xp_awarded AS xp
      FROM public.matches_1v1
      WHERE status = 'completed' AND challenger_xp_awarded <> 0
      UNION ALL
      SELECT id AS match_id, opponent_id AS user_id, opponent_xp_awarded AS xp
      FROM public.matches_1v1
      WHERE status = 'completed' AND opponent_xp_awarded <> 0
    ) u_matches
    GROUP BY user_id
  ),
  aggregated_users AS (
    SELECT 
      p.id AS user_id,
      p.username,
      COALESCE(p.display_name, p.username, 'Player') AS display_name,
      p.avatar_url,
      p.created_at,
      GREATEST(0::bigint, 
        COALESCE(ps.practice_net_xp, 0::bigint) + 
        COALESCE(cs.challenge_bonus_xp, 0::bigint) + 
        COALESCE(cts.contest_xp, 0::bigint) +
        COALESCE(ms.match_xp, 0::bigint)
      ) AS total_xp,
      COALESCE(ps.solved_count, 0) AS solved_count,
      CASE 
        WHEN COALESCE(ps.total_attempts, 0) > 0 
        THEN ROUND((ps.correct_attempts::numeric / ps.total_attempts::numeric) * 100.0, 1)
        ELSE 0.0
      END AS accuracy_percentage,
      COALESCE(cts.contests_count, 0) AS contests_count,
      COALESCE(ms.matches_count, 0) AS matches_count
    FROM public.profiles p
    LEFT JOIN practice_stats ps ON ps.user_id = p.id
    LEFT JOIN challenge_stats cs ON cs.user_id = p.id
    LEFT JOIN contest_stats cts ON cts.user_id = p.id
    LEFT JOIN match_stats ms ON ms.user_id = p.id
    WHERE p.username IS NOT NULL
      AND p.username NOT IN (
        'm3xpcheck99914',
        'm3xpcheck240836',
        'verify_xp_agg_85278',
        'verify_xp_agg_21673',
        'verify_xp_agg_57053',
        'm3testa44019',
        'm3testb52410',
        'regress_21448',
        'regress_18854',
        'regress_45535',
        'testu97603',
        'ctest_75447',
        'lifecycle_44494',
        'test_student_76469',
        'test_student_68411',
        'test_student_23043'
      )
  ),
  ranked_users AS (
    SELECT 
      *,
      DENSE_RANK() OVER (ORDER BY total_xp DESC, solved_count DESC, created_at ASC) AS global_rank
    FROM aggregated_users
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'rank', global_rank,
      'user_id', user_id,
      'username', username,
      'display_name', display_name,
      'avatar_url', avatar_url,
      'total_xp', total_xp,
      'solved_count', solved_count,
      'accuracy_percentage', accuracy_percentage,
      'contests_count', contests_count,
      'matches_count', matches_count
    )
  ) INTO v_leaderboard
  FROM (
    SELECT * FROM ranked_users
    ORDER BY global_rank ASC
    LIMIT v_limit OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object(
    'leaderboard', COALESCE(v_leaderboard, '[]'::jsonb),
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_global_leaderboard(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(INTEGER, INTEGER) TO anon, authenticated, service_role;


DROP FUNCTION IF EXISTS public.get_user_global_rank(UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION public.get_user_global_rank(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_total_count INTEGER := 0;
  v_prog JSONB;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ARGUMENT', 'message', 'User ID is required.');
  END IF;

  SELECT COUNT(*) INTO v_total_count
  FROM public.profiles
  WHERE username IS NOT NULL
    AND username NOT IN (
      'm3xpcheck99914',
      'm3xpcheck240836',
      'verify_xp_agg_85278',
      'verify_xp_agg_21673',
      'verify_xp_agg_57053',
      'm3testa44019',
      'm3testb52410',
      'regress_21448',
      'regress_18854',
      'regress_45535',
      'testu97603',
      'ctest_75447',
      'lifecycle_44494',
      'test_student_76469',
      'test_student_68411',
      'test_student_23043'
    );

  WITH practice_stats AS (
    SELECT 
      user_id,
      COALESCE(SUM(xp_change), 0) AS practice_net_xp,
      COUNT(DISTINCT question_id) FILTER (WHERE is_correct = TRUE) AS solved_count,
      COUNT(id) AS total_attempts,
      COUNT(id) FILTER (WHERE is_correct = TRUE) AS correct_attempts
    FROM public.user_question_attempts
    GROUP BY user_id
  ),
  challenge_stats AS (
    SELECT 
      user_id,
      COALESCE(SUM(bonus_xp_awarded), 0) AS challenge_bonus_xp
    FROM public.user_daily_challenge_completions
    GROUP BY user_id
  ),
  contest_stats AS (
    SELECT 
      user_id,
      COALESCE(SUM(xp_awarded), 0) AS contest_xp,
      COUNT(id) AS contests_count
    FROM public.contest_participants
    WHERE status = 'completed'
    GROUP BY user_id
  ),
  match_stats AS (
    SELECT 
      user_id,
      COALESCE(SUM(xp), 0) AS match_xp,
      COUNT(DISTINCT match_id) AS matches_count
    FROM (
      SELECT id AS match_id, challenger_id AS user_id, challenger_xp_awarded AS xp
      FROM public.matches_1v1
      WHERE status = 'completed' AND challenger_xp_awarded <> 0
      UNION ALL
      SELECT id AS match_id, opponent_id AS user_id, opponent_xp_awarded AS xp
      FROM public.matches_1v1
      WHERE status = 'completed' AND opponent_xp_awarded <> 0
    ) u_matches
    GROUP BY user_id
  ),
  aggregated_users AS (
    SELECT 
      p.id AS user_id,
      p.username,
      COALESCE(p.display_name, p.username, 'Player') AS display_name,
      p.avatar_url,
      p.created_at,
      GREATEST(0::bigint, 
        COALESCE(ps.practice_net_xp, 0::bigint) + 
        COALESCE(cs.challenge_bonus_xp, 0::bigint) + 
        COALESCE(cts.contest_xp, 0::bigint) +
        COALESCE(ms.match_xp, 0::bigint)
      ) AS total_xp,
      COALESCE(ps.solved_count, 0) AS solved_count,
      CASE 
        WHEN COALESCE(ps.total_attempts, 0) > 0 
        THEN ROUND((ps.correct_attempts::numeric / ps.total_attempts::numeric) * 100.0, 1)
        ELSE 0.0
      END AS accuracy_percentage,
      COALESCE(cts.contests_count, 0) AS contests_count,
      COALESCE(ms.matches_count, 0) AS matches_count
    FROM public.profiles p
    LEFT JOIN practice_stats ps ON ps.user_id = p.id
    LEFT JOIN challenge_stats cs ON cs.user_id = p.id
    LEFT JOIN contest_stats cts ON cts.user_id = p.id
    LEFT JOIN match_stats ms ON ms.user_id = p.id
    WHERE p.username IS NOT NULL
      AND p.username NOT IN (
        'm3xpcheck99914',
        'm3xpcheck240836',
        'verify_xp_agg_85278',
        'verify_xp_agg_21673',
        'verify_xp_agg_57053',
        'm3testa44019',
        'm3testb52410',
        'regress_21448',
        'regress_18854',
        'regress_45535',
        'testu97603',
        'ctest_75447',
        'lifecycle_44494',
        'test_student_76469',
        'test_student_68411',
        'test_student_23043'
      )
  ),
  ranked_users AS (
    SELECT 
      DENSE_RANK() OVER (
        ORDER BY 
          total_xp DESC,
          solved_count DESC,
          accuracy_percentage DESC,
          created_at ASC NULLS LAST,
          user_id ASC
      ) AS rank,
      user_id,
      username,
      display_name,
      avatar_url,
      total_xp,
      solved_count,
      accuracy_percentage,
      contests_count,
      matches_count
    FROM aggregated_users
  )
  SELECT * INTO v_user
  FROM ranked_users
  WHERE user_id = p_user_id;

  IF v_user.user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'found', false,
      'message', 'User not found in rankings.'
    );
  END IF;

  -- Calculate complete canonical level progression
  v_prog := public.calculate_level_progress(v_user.total_xp);

  RETURN jsonb_build_object(
    'success', true,
    'found', true,
    'rank', v_user.rank,
    'user_id', v_user.user_id,
    'username', v_user.username,
    'display_name', v_user.display_name,
    'avatar_url', v_user.avatar_url,
    'total_xp', v_user.total_xp,
    'solved_count', v_user.solved_count,
    'accuracy_percentage', v_user.accuracy_percentage,
    'contests_count', v_user.contests_count,
    'matches_count', v_user.matches_count,
    'level', (v_prog->>'level')::integer,
    'level_title', (v_prog->>'title')::text,
    'current_level_xp', (v_prog->>'current_level_xp')::integer,
    'next_level_xp', (v_prog->>'next_level_xp')::integer,
    'xp_in_level', (v_prog->>'xp_in_level')::integer,
    'xp_required', (v_prog->>'xp_required')::integer,
    'progress_percentage', (v_prog->>'progress_percentage')::numeric,
    'total_competitors', v_total_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_global_rank(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_global_rank(UUID) TO anon, authenticated, service_role;
