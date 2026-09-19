-- ==============================================================================
-- MODULE 10 — SOCIAL + 1v1: PHASE 2: SOCIAL CORE
-- Migration: MODULE_10_PHASE_2_SOCIAL_CORE.sql
-- ==============================================================================
-- Scope:
--   1. RLS Hardening: Lock down direct client mutations on user_follows & user_blocks
--   2. RPC: public.search_users(p_query, p_limit, p_offset)
--   3. RPC: public.get_public_profile(p_username)
--   4. RPC: public.toggle_follow_user(p_target_user_id)
--   5. RPC: public.get_user_followers(p_target_user_id, p_limit, p_offset)
--   6. RPC: public.get_user_following(p_target_user_id, p_limit, p_offset)
--   7. RPC: public.block_user(p_target_user_id)
--   8. RPC: public.unblock_user(p_target_user_id)
--   9. RPC: public.get_my_blocked_users()
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RLS HARDENING: Ensure all mutations go through server-authoritative RPCs
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create their own outgoing follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can delete their own outgoing follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can block other users" ON public.user_blocks;
DROP POLICY IF EXISTS "Users can unblock users" ON public.user_blocks;

-- Ensure SELECT policies on user_follows and user_blocks are intact
DROP POLICY IF EXISTS "Follow relationships are viewable unless blocked" ON public.user_follows;
CREATE POLICY "Follow relationships are viewable unless blocked"
  ON public.user_follows FOR SELECT
  USING (
    auth.uid() IS NULL OR (
      NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = following_id)
           OR (b.blocker_id = following_id AND b.blocked_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "Users can view their own block list" ON public.user_blocks;
CREATE POLICY "Users can view their own block list"
  ON public.user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);


-- ------------------------------------------------------------------------------
-- 2. RPC: public.search_users
-- Case-insensitive, sanitized user search respecting mutual block isolation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_users(
  p_query TEXT,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_clean_query TEXT;
  v_limit INT;
  v_offset INT;
  v_users JSONB;
BEGIN
  v_clean_query := trim(p_query);
  IF v_clean_query IS NULL OR length(v_clean_query) < 1 THEN
    RETURN jsonb_build_object('success', true, 'users', '[]'::jsonb, 'total_count', 0);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  -- Escape wildcards % and _ for safe ILIKE
  v_clean_query := replace(replace(v_clean_query, '%', '\%'), '_', '\_');

  WITH filtered_profiles AS (
    SELECT 
      p.id,
      p.username,
      COALESCE(p.display_name, p.username) AS display_name,
      p.avatar_url,
      p.bio,
      p.created_at
    FROM public.profiles p
    WHERE p.username IS NOT NULL
      AND (
        p.username ILIKE '%' || v_clean_query || '%'
        OR p.display_name ILIKE '%' || v_clean_query || '%'
      )
      -- Exclude automated test accounts
      AND p.username NOT IN (
        'm3xpcheck99914', 'm3xpcheck240836', 'verify_xp_agg_85278', 'verify_xp_agg_21673',
        'verify_xp_agg_57053', 'm3testa44019', 'm3testb52410', 'regress_21448',
        'regress_18854', 'regress_45535', 'testu97603', 'ctest_75447', 'lifecycle_44494',
        'test_student_76469', 'test_student_68411', 'test_student_23043'
      )
      -- Mutual blocking check: neither user has blocked the other
      AND (
        v_caller_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p.id)
             OR (b.blocker_id = p.id AND b.blocked_id = v_caller_id)
        )
      )
  ),
  user_stats AS (
    SELECT 
      fp.id,
      fp.username,
      fp.display_name,
      fp.avatar_url,
      fp.bio,
      fp.created_at,
      GREATEST(0::bigint,
        COALESCE((SELECT SUM(xp_change) FROM public.user_question_attempts WHERE user_id = fp.id), 0::bigint) +
        COALESCE((SELECT SUM(bonus_xp_awarded) FROM public.user_daily_challenge_completions WHERE user_id = fp.id), 0::bigint) +
        COALESCE((SELECT SUM(xp_awarded) FROM public.contest_participants WHERE user_id = fp.id AND status = 'completed'), 0::bigint)
      ) AS total_xp,
      COALESCE((SELECT COUNT(DISTINCT question_id) FROM public.user_question_attempts WHERE user_id = fp.id AND is_correct = TRUE), 0) AS solved_count,
      CASE 
        WHEN v_caller_id IS NOT NULL AND v_caller_id <> fp.id THEN
          EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id = v_caller_id AND following_id = fp.id)
        ELSE FALSE
      END AS is_following
    FROM filtered_profiles fp
  ),
  user_results AS (
    SELECT 
      us.*,
      public.calculate_level_progress(us.total_xp) AS prog
    FROM user_stats us
    ORDER BY us.total_xp DESC, us.solved_count DESC, us.username ASC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ur.id,
      'username', ur.username,
      'display_name', ur.display_name,
      'avatar_url', ur.avatar_url,
      'bio', ur.bio,
      'total_xp', ur.total_xp,
      'level', (ur.prog->>'level')::int,
      'level_title', (ur.prog->>'title')::text,
      'solved_count', ur.solved_count,
      'is_following', ur.is_following,
      'is_caller', (v_caller_id IS NOT NULL AND v_caller_id = ur.id)
    )
  ) INTO v_users
  FROM user_results ur;

  RETURN jsonb_build_object(
    'success', true,
    'users', COALESCE(v_users, '[]'::jsonb),
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_users(TEXT, INT, INT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. RPC: public.get_public_profile
-- Comprehensive public profile card respecting mutual block isolation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile(p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_clean_username TEXT;
  v_target RECORD;
  v_total_xp BIGINT := 0;
  v_solved_count INT := 0;
  v_total_attempts INT := 0;
  v_correct_attempts INT := 0;
  v_wrong_attempts INT := 0;
  v_accuracy NUMERIC(5,2) := 0.00;
  v_contests_count INT := 0;
  v_current_streak INT := 0;
  v_followers_count INT := 0;
  v_following_count INT := 0;
  v_is_following BOOLEAN := FALSE;
  v_is_blocked_by_caller BOOLEAN := FALSE;
  v_prog JSONB;
  v_rank_res JSONB;
  v_rank INT := NULL;
BEGIN
  v_clean_username := lower(trim(p_username));
  IF v_clean_username IS NULL OR length(v_clean_username) < 1 THEN
    RETURN jsonb_build_object('success', false, 'found', false, 'message', 'Username is required.');
  END IF;

  -- 1. Fetch target profile row
  SELECT 
    id, username, display_name, avatar_url, bio, created_at
  INTO v_target
  FROM public.profiles
  WHERE lower(trim(username)) = v_clean_username;

  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'found', false, 'message', 'User not found.');
  END IF;

  -- 2. Mutual Block Check: if either user has blocked the other, treat user as unavailable
  IF v_caller_id IS NOT NULL AND v_caller_id <> v_target.id THEN
    IF EXISTS (
      SELECT 1 FROM public.user_blocks 
      WHERE (blocker_id = v_caller_id AND blocked_id = v_target.id)
         OR (blocker_id = v_target.id AND blocked_id = v_caller_id)
    ) THEN
      -- If caller is the one who blocked them, still allow seeing block state on public profile
      IF EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = v_caller_id AND blocked_id = v_target.id) THEN
        v_is_blocked_by_caller := TRUE;
      ELSE
        -- Target blocked caller: hide completely
        RETURN jsonb_build_object('success', false, 'found', false, 'message', 'User unavailable.');
      END IF;
    END IF;
  END IF;

  -- 3. Aggregate practice stats
  SELECT 
    COUNT(id),
    COUNT(id) FILTER (WHERE is_correct = TRUE),
    COUNT(id) FILTER (WHERE is_correct = FALSE),
    COUNT(DISTINCT question_id) FILTER (WHERE is_correct = TRUE),
    COALESCE(SUM(xp_change), 0)
  INTO 
    v_total_attempts,
    v_correct_attempts,
    v_wrong_attempts,
    v_solved_count,
    v_total_xp
  FROM public.user_question_attempts
  WHERE user_id = v_target.id;

  -- 4. Aggregate daily challenge & contest XP
  v_total_xp := GREATEST(0::bigint,
    v_total_xp +
    COALESCE((SELECT SUM(bonus_xp_awarded) FROM public.user_daily_challenge_completions WHERE user_id = v_target.id), 0::bigint) +
    COALESCE((SELECT SUM(xp_awarded) FROM public.contest_participants WHERE user_id = v_target.id AND status = 'completed'), 0::bigint)
  );

  IF v_total_attempts > 0 THEN
    v_accuracy := ROUND((v_correct_attempts::numeric / v_total_attempts::numeric) * 100.0, 1);
  END IF;

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
  IF (v_rank_res->>'found')::boolean = true THEN
    v_rank := (v_rank_res->>'rank')::int;
  END IF;

  -- Social Counts (filtered to exclude any users blocked by or blocking the caller)
  SELECT COUNT(*) INTO v_followers_count
  FROM public.user_follows uf
  WHERE uf.following_id = v_target.id
    AND (
      v_caller_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_caller_id AND b.blocked_id = uf.follower_id)
           OR (b.blocker_id = uf.follower_id AND b.blocked_id = v_caller_id)
      )
    );

  SELECT COUNT(*) INTO v_following_count
  FROM public.user_follows uf
  WHERE uf.follower_id = v_target.id
    AND (
      v_caller_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_caller_id AND b.blocked_id = uf.following_id)
           OR (b.blocker_id = uf.following_id AND b.blocked_id = v_caller_id)
      )
    );

  -- Follow State
  IF v_caller_id IS NOT NULL AND v_caller_id <> v_target.id THEN
    v_is_following := EXISTS (
      SELECT 1 FROM public.user_follows 
      WHERE follower_id = v_caller_id AND following_id = v_target.id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'found', true,
    'profile', jsonb_build_object(
      'id', v_target.id,
      'username', v_target.username,
      'display_name', COALESCE(v_target.display_name, v_target.username),
      'avatar_url', v_target.avatar_url,
      'bio', v_target.bio,
      'created_at', v_target.created_at,
      'total_xp', v_total_xp,
      'rank', v_rank,
      'level', (v_prog->>'level')::int,
      'level_title', (v_prog->>'title')::text,
      'current_level_xp', (v_prog->>'current_level_xp')::int,
      'next_level_xp', (v_prog->>'next_level_xp')::int,
      'xp_in_level', (v_prog->>'xp_in_level')::int,
      'xp_required', (v_prog->>'xp_required')::int,
      'progress_percentage', (v_prog->>'progress_percentage')::numeric,
      'total_attempts', v_total_attempts,
      'correct_attempts', v_correct_attempts,
      'wrong_attempts', v_wrong_attempts,
      'solved_count', v_solved_count,
      'accuracy_percentage', v_accuracy,
      'contests_count', v_contests_count,
      'current_streak', v_current_streak,
      'followers_count', v_followers_count,
      'following_count', v_following_count,
      'is_following', v_is_following,
      'is_caller', (v_caller_id IS NOT NULL AND v_caller_id = v_target.id),
      'is_blocked_by_caller', v_is_blocked_by_caller
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. RPC: public.toggle_follow_user
-- Atomic, server-authoritative follow/unfollow toggle with notifications
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_follow_user(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_exists BOOLEAN;
  v_target_username TEXT;
  v_caller_username TEXT;
  v_caller_display TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  IF p_target_user_id IS NULL OR v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION', 'message', 'Cannot follow yourself.');
  END IF;

  SELECT username INTO v_target_username FROM public.profiles WHERE id = p_target_user_id;
  IF v_target_username IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'User not found.');
  END IF;

  -- Block check
  IF EXISTS (
    SELECT 1 FROM public.user_blocks 
    WHERE (blocker_id = v_caller_id AND blocked_id = p_target_user_id)
       OR (blocker_id = p_target_user_id AND blocked_id = v_caller_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'BLOCKED', 'message', 'Unable to follow this user.');
  END IF;

  -- Check current state
  SELECT EXISTS (
    SELECT 1 FROM public.user_follows 
    WHERE follower_id = v_caller_id AND following_id = p_target_user_id
  ) INTO v_exists;

  IF v_exists THEN
    -- Unfollow
    DELETE FROM public.user_follows 
    WHERE follower_id = v_caller_id AND following_id = p_target_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'following', false,
      'message', 'Unfollowed @' || v_target_username
    );
  ELSE
    -- Follow
    INSERT INTO public.user_follows (follower_id, following_id, created_at)
    VALUES (v_caller_id, p_target_user_id, NOW())
    ON CONFLICT (follower_id, following_id) DO NOTHING;

    -- Notification dispatch
    SELECT username, COALESCE(display_name, username) 
    INTO v_caller_username, v_caller_display 
    FROM public.profiles WHERE id = v_caller_id;

    INSERT INTO public.notifications (user_id, actor_id, type, title, message, data, created_at)
    VALUES (
      p_target_user_id,
      v_caller_id,
      'new_follower',
      'New Follower',
      COALESCE(v_caller_display, '@' || v_caller_username) || ' started following you.',
      jsonb_build_object('follower_id', v_caller_id, 'username', v_caller_username),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', true,
      'following', true,
      'message', 'Now following @' || v_target_username
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_follow_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_follow_user(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. RPC: public.get_user_followers
-- Returns paginated follower list respecting mutual block isolation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_followers(
  p_target_user_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_limit INT;
  v_offset INT;
  v_total_count INT := 0;
  v_followers JSONB;
BEGIN
  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ARGUMENT', 'message', 'Target user ID is required.');
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  -- Target mutual block check
  IF v_caller_id IS NOT NULL AND v_caller_id <> p_target_user_id THEN
    IF EXISTS (
      SELECT 1 FROM public.user_blocks 
      WHERE (blocker_id = v_caller_id AND blocked_id = p_target_user_id)
         OR (blocker_id = p_target_user_id AND blocked_id = v_caller_id)
    ) THEN
      RETURN jsonb_build_object('success', true, 'total_count', 0, 'followers', '[]'::jsonb);
    END IF;
  END IF;

  -- Count valid followers
  SELECT COUNT(*) INTO v_total_count
  FROM public.user_follows uf
  JOIN public.profiles p ON p.id = uf.follower_id
  WHERE uf.following_id = p_target_user_id
    AND (
      v_caller_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = v_caller_id)
      )
    );

  WITH follower_rows AS (
    SELECT 
      p.id,
      p.username,
      COALESCE(p.display_name, p.username) AS display_name,
      p.avatar_url,
      p.bio,
      uf.created_at AS followed_at,
      GREATEST(0::bigint,
        COALESCE((SELECT SUM(xp_change) FROM public.user_question_attempts WHERE user_id = p.id), 0::bigint) +
        COALESCE((SELECT SUM(bonus_xp_awarded) FROM public.user_daily_challenge_completions WHERE user_id = p.id), 0::bigint) +
        COALESCE((SELECT SUM(xp_awarded) FROM public.contest_participants WHERE user_id = p.id AND status = 'completed'), 0::bigint)
      ) AS total_xp,
      CASE 
        WHEN v_caller_id IS NOT NULL AND v_caller_id <> p.id THEN
          EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id = v_caller_id AND following_id = p.id)
        ELSE FALSE
      END AS is_following
    FROM public.user_follows uf
    JOIN public.profiles p ON p.id = uf.follower_id
    WHERE uf.following_id = p_target_user_id
      AND (
        v_caller_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p.id)
             OR (b.blocker_id = p.id AND b.blocked_id = v_caller_id)
        )
      )
    ORDER BY uf.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ),
  with_progression AS (
    SELECT 
      fr.*,
      public.calculate_level_progress(fr.total_xp) AS prog
    FROM follower_rows fr
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', wp.id,
      'username', wp.username,
      'display_name', wp.display_name,
      'avatar_url', wp.avatar_url,
      'bio', wp.bio,
      'total_xp', wp.total_xp,
      'level', (wp.prog->>'level')::int,
      'level_title', (wp.prog->>'title')::text,
      'is_following', wp.is_following,
      'is_caller', (v_caller_id IS NOT NULL AND v_caller_id = wp.id),
      'followed_at', wp.followed_at
    )
  ) INTO v_followers
  FROM with_progression wp;

  RETURN jsonb_build_object(
    'success', true,
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset,
    'followers', COALESCE(v_followers, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_followers(UUID, INT, INT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. RPC: public.get_user_following
-- Returns paginated list of accounts followed by target user
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_following(
  p_target_user_id UUID,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_limit INT;
  v_offset INT;
  v_total_count INT := 0;
  v_following JSONB;
BEGIN
  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ARGUMENT', 'message', 'Target user ID is required.');
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  -- Target mutual block check
  IF v_caller_id IS NOT NULL AND v_caller_id <> p_target_user_id THEN
    IF EXISTS (
      SELECT 1 FROM public.user_blocks 
      WHERE (blocker_id = v_caller_id AND blocked_id = p_target_user_id)
         OR (blocker_id = p_target_user_id AND blocked_id = v_caller_id)
    ) THEN
      RETURN jsonb_build_object('success', true, 'total_count', 0, 'following', '[]'::jsonb);
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_total_count
  FROM public.user_follows uf
  JOIN public.profiles p ON p.id = uf.following_id
  WHERE uf.follower_id = p_target_user_id
    AND (
      v_caller_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = v_caller_id)
      )
    );

  WITH following_rows AS (
    SELECT 
      p.id,
      p.username,
      COALESCE(p.display_name, p.username) AS display_name,
      p.avatar_url,
      p.bio,
      uf.created_at AS followed_at,
      GREATEST(0::bigint,
        COALESCE((SELECT SUM(xp_change) FROM public.user_question_attempts WHERE user_id = p.id), 0::bigint) +
        COALESCE((SELECT SUM(bonus_xp_awarded) FROM public.user_daily_challenge_completions WHERE user_id = p.id), 0::bigint) +
        COALESCE((SELECT SUM(xp_awarded) FROM public.contest_participants WHERE user_id = p.id AND status = 'completed'), 0::bigint)
      ) AS total_xp,
      CASE 
        WHEN v_caller_id IS NOT NULL AND v_caller_id <> p.id THEN
          EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id = v_caller_id AND following_id = p.id)
        ELSE FALSE
      END AS is_following
    FROM public.user_follows uf
    JOIN public.profiles p ON p.id = uf.following_id
    WHERE uf.follower_id = p_target_user_id
      AND (
        v_caller_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.user_blocks b
          WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p.id)
             OR (b.blocker_id = p.id AND b.blocked_id = v_caller_id)
        )
      )
    ORDER BY uf.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ),
  with_progression AS (
    SELECT 
      fr.*,
      public.calculate_level_progress(fr.total_xp) AS prog
    FROM following_rows fr
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', wp.id,
      'username', wp.username,
      'display_name', wp.display_name,
      'avatar_url', wp.avatar_url,
      'bio', wp.bio,
      'total_xp', wp.total_xp,
      'level', (wp.prog->>'level')::int,
      'level_title', (wp.prog->>'title')::text,
      'is_following', wp.is_following,
      'is_caller', (v_caller_id IS NOT NULL AND v_caller_id = wp.id),
      'followed_at', wp.followed_at
    )
  ) INTO v_following
  FROM with_progression wp;

  RETURN jsonb_build_object(
    'success', true,
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset,
    'following', COALESCE(v_following, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_following(UUID, INT, INT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 7. RPC: public.block_user
-- Transactional social block with automatic cleanup of follows, friends & matches
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_user(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target_username TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  IF p_target_user_id IS NULL OR v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION', 'message', 'Cannot block yourself.');
  END IF;

  SELECT username INTO v_target_username FROM public.profiles WHERE id = p_target_user_id;
  IF v_target_username IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'User not found.');
  END IF;

  -- 1. Insert block record (idempotent)
  INSERT INTO public.user_blocks (blocker_id, blocked_id, created_at)
  VALUES (v_caller_id, p_target_user_id, NOW())
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  -- 2. Purge follow relationships in BOTH directions
  DELETE FROM public.user_follows
  WHERE (follower_id = v_caller_id AND following_id = p_target_user_id)
     OR (follower_id = p_target_user_id AND following_id = v_caller_id);

  -- 3. Purge any friendships between the two users
  DELETE FROM public.friendships
  WHERE (sender_id = v_caller_id AND receiver_id = p_target_user_id)
     OR (sender_id = p_target_user_id AND receiver_id = v_caller_id);

  -- 4. Cancel any pending 1v1 challenges between them
  UPDATE public.matches_1v1
  SET status = 'cancelled', updated_at = NOW()
  WHERE status = 'pending'
    AND ((challenger_id = v_caller_id AND opponent_id = p_target_user_id)
      OR (challenger_id = p_target_user_id AND opponent_id = v_caller_id));

  RETURN jsonb_build_object(
    'success', true,
    'blocked', true,
    'message', 'Blocked @' || v_target_username
  );
END;
$$;

REVOKE ALL ON FUNCTION public.block_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_user(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 8. RPC: public.unblock_user
-- Authoritative unblock operation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unblock_user(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_target_username TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  IF p_target_user_id IS NULL OR v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION', 'message', 'Invalid target.');
  END IF;

  SELECT username INTO v_target_username FROM public.profiles WHERE id = p_target_user_id;

  DELETE FROM public.user_blocks
  WHERE blocker_id = v_caller_id AND blocked_id = p_target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'blocked', false,
    'message', 'Unblocked @' || COALESCE(v_target_username, 'user')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.unblock_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unblock_user(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 9. RPC: public.get_my_blocked_users
-- Returns caller's private list of blocked accounts
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_blocked_users()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_blocked JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'username', p.username,
      'display_name', COALESCE(p.display_name, p.username),
      'avatar_url', p.avatar_url,
      'blocked_at', ub.created_at
    ) ORDER BY ub.created_at DESC
  ) INTO v_blocked
  FROM public.user_blocks ub
  JOIN public.profiles p ON p.id = ub.blocked_id
  WHERE ub.blocker_id = v_caller_id;

  RETURN jsonb_build_object(
    'success', true,
    'blocked_users', COALESCE(v_blocked, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_blocked_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_blocked_users() TO authenticated, service_role;
