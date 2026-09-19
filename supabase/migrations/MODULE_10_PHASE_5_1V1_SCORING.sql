-- ==============================================================================
-- MODULE 10 — PHASE 5: LIVE 1v1 BATTLE ARENA & SERVER-AUTHORITATIVE SCORING
-- Migration: MODULE_10_PHASE_5_1V1_SCORING.sql
-- ==============================================================================
-- Scope:
--   1. RPC: submit_1v1_answer (Server-authoritative evaluation, timer, & scoring)
--   2. RPC: finalize_1v1_match (Idempotent, row-locked match finalization)
--   3. RPC: get_1v1_game_state (Zero-leak game state for Arena and reconnect recovery)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: submit_1v1_answer
-- Server-authoritative answer submission, scoring, and duplicate protection
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

  -- 4. Verify match is currently active / in_progress
  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_ALREADY_COMPLETED', 'message', 'Match is already completed.');
  END IF;

  IF v_match.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_IN_PROGRESS', 'message', 'Match is not in progress.');
  END IF;

  -- 5. Server-Authoritative Deadline Check
  -- Total duration = question_count * time_per_question_seconds
  v_total_duration_secs := v_match.question_count * v_match.time_per_question_seconds;
  v_deadline := v_match.started_at + (v_total_duration_secs * INTERVAL '1 second');

  -- Allow 5 seconds network transit buffer before hard deadline rejection
  IF NOW() > v_deadline + INTERVAL '5 seconds' THEN
    -- Finalize match automatically
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

  -- Server derives elapsed time; clamp client-supplied time safely
  v_authoritative_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - v_match.started_at))::integer);
  v_safe_time_spent := GREATEST(0, LEAST(COALESCE(p_time_spent_seconds, 0), v_authoritative_elapsed));

  -- 9. Insert answer into match_1v1_answers (Unique constraint protects against concurrent duplicates)
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
    WHERE id = p_match_id;
    v_new_caller_score := v_match.challenger_score + v_points_awarded;
  ELSE
    UPDATE public.matches_1v1
    SET opponent_score = opponent_score + v_points_awarded,
        opponent_time_taken = opponent_time_taken + v_safe_time_spent,
        updated_at = NOW()
    WHERE id = p_match_id;
    v_new_caller_score := v_match.opponent_score + v_points_awarded;
  END IF;

  -- 11. Check progress for both players
  SELECT COUNT(*) INTO v_caller_answered_count
  FROM public.match_1v1_answers
  WHERE match_id = p_match_id AND user_id = v_caller_id;

  SELECT COUNT(*) INTO v_opponent_answered_count
  FROM public.match_1v1_answers
  WHERE match_id = p_match_id
    AND user_id = CASE WHEN v_caller_id = v_match.challenger_id THEN v_match.opponent_id ELSE v_match.challenger_id END;

  -- 12. If both players have completed all questions, auto-finalize the match immediately
  IF v_caller_answered_count >= v_match.question_count AND v_opponent_answered_count >= v_match.question_count THEN
    PERFORM public.finalize_1v1_match(p_match_id);
    v_is_match_completed := TRUE;
  END IF;

  -- 13. Return safe result data (ZERO answer-key leakage)
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
-- 2. RPC: finalize_1v1_match
-- Idempotent, transaction-safe match finalization and winner determination
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
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Lock match row
  SELECT * INTO v_match
  FROM public.matches_1v1
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_FOUND', 'message', 'Match not found.');
  END IF;

  -- 2. Idempotency: If already completed, return existing final result
  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'completed',
      'match_id', p_match_id,
      'challenger_score', v_match.challenger_score,
      'opponent_score', v_match.opponent_score,
      'winner_id', v_match.winner_id,
      'is_draw', v_match.is_draw,
      'completed_at', v_match.completed_at,
      'message', 'Match is already completed.'
    );
  END IF;

  -- 3. Validate caller authorization (participant or service_role)
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

  -- 5. Determine Winner / Loser / Draw
  IF v_c_score > v_o_score THEN
    v_winner_id := v_match.challenger_id;
    v_is_draw := FALSE;
  ELSIF v_o_score > v_c_score THEN
    v_winner_id := v_match.opponent_id;
    v_is_draw := FALSE;
  ELSE
    v_winner_id := NULL;
    v_is_draw := TRUE;
  END IF;

  -- 6. Update matches_1v1 to completed
  UPDATE public.matches_1v1
  SET status = 'completed',
      challenger_score = v_c_score,
      opponent_score = v_o_score,
      challenger_time_taken = v_c_time,
      opponent_time_taken = v_o_time,
      winner_id = v_winner_id,
      is_draw = v_is_draw,
      completed_at = v_now,
      updated_at = v_now
  WHERE id = p_match_id;

  -- 7. Dispatch in-app notifications to participants
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
      WHEN v_is_draw THEN 'Your 1v1 battle ended in a draw!'
      WHEN v_winner_id = v_match.challenger_id THEN 'Victory! You won the 1v1 battle!'
      ELSE 'The 1v1 battle has concluded.'
    END,
    jsonb_build_object(
      'match_id', p_match_id,
      'challenger_score', v_c_score,
      'opponent_score', v_o_score,
      'winner_id', v_winner_id,
      'is_draw', v_is_draw
    )
  ),
  (
    v_match.opponent_id,
    v_match.challenger_id,
    'match_completed',
    '1v1 Battle Concluded',
    CASE
      WHEN v_is_draw THEN 'Your 1v1 battle ended in a draw!'
      WHEN v_winner_id = v_match.opponent_id THEN 'Victory! You won the 1v1 battle!'
      ELSE 'The 1v1 battle has concluded.'
    END,
    jsonb_build_object(
      'match_id', p_match_id,
      'challenger_score', v_c_score,
      'opponent_score', v_o_score,
      'winner_id', v_winner_id,
      'is_draw', v_is_draw
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
    'completed_at', v_now,
    'message', 'Match finalized successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_1v1_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_1v1_match(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. RPC: get_1v1_game_state
-- Authoritative, zero-leak game state for active arena and reconnect recovery
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

  -- 7. Fetch Opponent Answers ONLY IF MATCH IS COMPLETED (Anti-cheat privacy during battle)
  IF v_match.status = 'completed' THEN
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
      'is_caller_challenger', v_is_caller_challenger,
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
