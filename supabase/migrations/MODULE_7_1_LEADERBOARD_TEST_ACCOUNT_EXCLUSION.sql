-- ==============================================================================
-- MODULE 7.1 — LEADERBOARD TEST ACCOUNT EXCLUSION
-- ==============================================================================
-- Excludes known seeded automated test & verification accounts from the public
-- Global Arena standings (RPC get_global_leaderboard and get_user_global_rank).
-- Genuine users (ayush, laksh, ajp, laddu, lakshdave, viratkohli, pravesh,
-- ansh, pal, golu, ino, pappu_pelu, divyansh) are preserved with deterministic ranks.
--
-- Strict Rules:
-- - No schema change (no is_test column added).
-- - No user records deleted or mutated.
-- - No XP changes or rank calculation changes.
-- - Pure server-side authoritative filtering for public leaderboard.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Update RPC: get_global_leaderboard
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
        COALESCE(cts.contest_xp, 0::bigint)
      ) AS total_xp,
      COALESCE(ps.solved_count, 0) AS solved_count,
      CASE 
        WHEN COALESCE(ps.total_attempts, 0) > 0 
        THEN ROUND((ps.correct_attempts::numeric / ps.total_attempts::numeric) * 100.0, 1)
        ELSE 0.0
      END AS accuracy_percentage,
      COALESCE(cts.contests_count, 0) AS contests_count
    FROM public.profiles p
    LEFT JOIN practice_stats ps ON ps.user_id = p.id
    LEFT JOIN challenge_stats cs ON cs.user_id = p.id
    LEFT JOIN contest_stats cts ON cts.user_id = p.id
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
-- 2. Update RPC: get_user_global_rank
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
        COALESCE(cts.contest_xp, 0::bigint)
      ) AS total_xp,
      COALESCE(ps.solved_count, 0) AS solved_count,
      CASE 
        WHEN COALESCE(ps.total_attempts, 0) > 0 
        THEN ROUND((ps.correct_attempts::numeric / ps.total_attempts::numeric) * 100.0, 1)
        ELSE 0.0
      END AS accuracy_percentage,
      COALESCE(cts.contests_count, 0) AS contests_count
    FROM public.profiles p
    LEFT JOIN practice_stats ps ON ps.user_id = p.id
    LEFT JOIN challenge_stats cs ON cs.user_id = p.id
    LEFT JOIN contest_stats cts ON cts.user_id = p.id
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
      contests_count
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
