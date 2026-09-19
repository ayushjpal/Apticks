-- ==============================================================================
-- MODULE 10 — PHASE 6: 1v1 XP + PROGRESSION + GLOBAL LEADERBOARD INTEGRATION
-- File: supabase/migrations/MODULE_10_PHASE_6_1V1_XP_PROGRESSION.sql
-- ==============================================================================
--
-- Authoritative 1v1 XP Reward Rules:
--   WIN:  +50 XP
--   DRAW: +20 XP (for BOTH competitors)
--   LOSS: +5 XP
--
-- Features:
-- 1. finalize_1v1_match(): Idempotent, server-authoritative XP award and persistence.
-- 2. get_user_total_xp(): Unified formula: MAX(0, Practice + Daily + Contest + 1v1).
-- 3. get_global_leaderboard(): Includes 1v1 match XP in unified standings.
-- 4. get_user_global_rank(): Includes 1v1 match XP in individual standing and progression.
-- 5. get_1v1_game_state(): Safely reveals XP awarded only after match completion.
-- 6. get_user_public_profile(): Delegates total_xp to get_user_total_xp().
--
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UPDATE RPC: finalize_1v1_match
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

  -- 2. Idempotency: If already completed, return existing final result with persisted XP
  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'completed',
      'match_id', p_match_id,
      'challenger_score', v_match.challenger_score,
      'opponent_score', v_match.opponent_score,
      'winner_id', v_match.winner_id,
      'is_draw', v_match.is_draw,
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
  -- WIN: +50 XP, DRAW: +20 XP (for both), LOSS: +5 XP
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

  -- 7. Dispatch in-app notifications with XP awarded
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
-- 2. UPDATE RPC: get_user_total_xp
-- Canonical unified total XP including Practice, Daily, Contest, and 1v1 Match XP
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
-- 3. UPDATE RPC: get_global_leaderboard
-- Incorporates 1v1 Match XP into global aggregated standings
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
  -- Count total ranked competitors (profiles with a valid handle, excluding seeded test accounts)
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

  -- Build aggregated deterministic standings
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
      WHERE status = 'completed' AND challenger_xp_awarded > 0
      UNION ALL
      SELECT id AS match_id, opponent_id AS user_id, opponent_xp_awarded AS xp
      FROM public.matches_1v1
      WHERE status = 'completed' AND opponent_xp_awarded > 0
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
  users_with_progression AS (
    SELECT 
      a.*,
      public.calculate_level_progress(a.total_xp) AS prog
    FROM aggregated_users a
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
      matches_count,
      (prog->>'level')::integer AS level,
      (prog->>'title')::text AS level_title
    FROM users_with_progression
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'rank', r.rank,
      'user_id', r.user_id,
      'username', r.username,
      'display_name', r.display_name,
      'avatar_url', r.avatar_url,
      'total_xp', r.total_xp,
      'solved_count', r.solved_count,
      'accuracy_percentage', r.accuracy_percentage,
      'contests_count', r.contests_count,
      'matches_count', r.matches_count,
      'level', r.level,
      'level_title', r.level_title
    ) ORDER BY r.rank ASC, r.total_xp DESC, r.solved_count DESC, r.user_id ASC
  ) INTO v_leaderboard
  FROM (
    SELECT *
    FROM ranked_users
    ORDER BY rank ASC, total_xp DESC, solved_count DESC, user_id ASC
    LIMIT v_limit
    OFFSET v_offset
  ) r;

  RETURN jsonb_build_object(
    'success', true,
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset,
    'leaderboard', COALESCE(v_leaderboard, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_global_leaderboard(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard(INTEGER, INTEGER) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. UPDATE RPC: get_user_global_rank
-- Incorporates 1v1 Match XP into individual competitor rank & progression
-- ------------------------------------------------------------------------------
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
      WHERE status = 'completed' AND challenger_xp_awarded > 0
      UNION ALL
      SELECT id AS match_id, opponent_id AS user_id, opponent_xp_awarded AS xp
      FROM public.matches_1v1
      WHERE status = 'completed' AND opponent_xp_awarded > 0
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


-- ------------------------------------------------------------------------------
-- 5. UPDATE RPC: get_1v1_game_state
-- Reveals XP awarded only after match completion (Zero-leak in active battles)
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

  -- 7. Fetch Opponent Answers ONLY IF MATCH IS COMPLETED (Anti-cheat privacy during battle)
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
-- 6. UPDATE RPC: get_user_public_profile
-- Ensures public athlete cards reflect unified XP from get_user_total_xp()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_public_profile(
  p_target_user_id UUID,
  p_caller_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target RECORD;
  v_total_xp BIGINT := 0;
  v_solved_count INTEGER := 0;
  v_total_attempts INTEGER := 0;
  v_correct_attempts INTEGER := 0;
  v_wrong_attempts INTEGER := 0;
  v_accuracy NUMERIC := 0.0;
  v_contests_count INTEGER := 0;
  v_current_streak INTEGER := 0;
  v_followers_count INTEGER := 0;
  v_following_count INTEGER := 0;
  v_is_following BOOLEAN := FALSE;
  v_is_blocked_by_caller BOOLEAN := FALSE;
  v_is_blocking_caller BOOLEAN := FALSE;
  v_rank_res JSONB;
  v_prog JSONB;
BEGIN
  -- 1. Fetch Target Profile
  SELECT id, username, display_name, avatar_url, cover_url, bio, role, created_at
  INTO v_target
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND', 'message', 'Profile not found.');
  END IF;

  -- 2. Check blocks
  IF p_caller_id IS NOT NULL AND p_caller_id <> p_target_user_id THEN
    SELECT EXISTS(
      SELECT 1 FROM public.user_blocks WHERE blocker_id = p_caller_id AND blocked_id = p_target_user_id
    ) INTO v_is_blocked_by_caller;

    SELECT EXISTS(
      SELECT 1 FROM public.user_blocks WHERE blocker_id = p_target_user_id AND blocked_id = p_caller_id
    ) INTO v_is_blocking_caller;
  END IF;

  -- 3. Practice stats
  SELECT 
    COALESCE(COUNT(id), 0),
    COALESCE(COUNT(id) FILTER (WHERE is_correct = TRUE), 0),
    COALESCE(COUNT(id) FILTER (WHERE is_correct = FALSE), 0),
    COALESCE(COUNT(DISTINCT question_id) FILTER (WHERE is_correct = TRUE), 0)
  INTO 
    v_total_attempts,
    v_correct_attempts,
    v_wrong_attempts,
    v_solved_count
  FROM public.user_question_attempts
  WHERE user_id = v_target.id;

  IF v_total_attempts > 0 THEN
    v_accuracy := ROUND((v_correct_attempts::numeric / v_total_attempts::numeric) * 100.0, 1);
  END IF;

  -- 4. Authoritative Unified Total XP via get_user_total_xp()
  v_total_xp := public.get_user_total_xp(v_target.id);

  -- Contests count
  SELECT COUNT(id) INTO v_contests_count
  FROM public.contest_participants
  WHERE user_id = v_target.id AND status = 'completed';

  -- Current streak
  SELECT COALESCE(current_streak, 0) INTO v_current_streak
  FROM public.user_streaks
  WHERE user_id = v_target.id;

  -- Progression
  v_prog := public.calculate_level_progress(v_total_xp);

  -- Rank calculation
  v_rank_res := public.get_user_global_rank(v_target.id);

  -- Followers / Following count
  SELECT COUNT(id) INTO v_followers_count
  FROM public.user_follows
  WHERE following_id = v_target.id;

  SELECT COUNT(id) INTO v_following_count
  FROM public.user_follows
  WHERE follower_id = v_target.id;

  -- Relationship with caller
  IF p_caller_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.user_follows
      WHERE follower_id = p_caller_id AND following_id = v_target.id
    ) INTO v_is_following;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_target.id,
      'username', v_target.username,
      'display_name', COALESCE(v_target.display_name, v_target.username, 'Player'),
      'avatar_url', v_target.avatar_url,
      'cover_url', v_target.cover_url,
      'bio', v_target.bio,
      'role', v_target.role,
      'created_at', v_target.created_at,
      'stats', jsonb_build_object(
        'total_xp', v_total_xp,
        'solved_count', v_solved_count,
        'total_attempts', v_total_attempts,
        'correct_attempts', v_correct_attempts,
        'wrong_attempts', v_wrong_attempts,
        'accuracy_percentage', v_accuracy,
        'contests_count', v_contests_count,
        'current_streak', v_current_streak,
        'followers_count', v_followers_count,
        'following_count', v_following_count,
        'global_rank', COALESCE((v_rank_res->>'rank')::integer, 0)
      ),
      'progression', v_prog,
      'relationship', jsonb_build_object(
        'is_following', v_is_following,
        'is_blocked_by_caller', v_is_blocked_by_caller,
        'is_blocking_caller', v_is_blocking_caller
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_public_profile(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_public_profile(UUID, UUID) TO anon, authenticated, service_role;
