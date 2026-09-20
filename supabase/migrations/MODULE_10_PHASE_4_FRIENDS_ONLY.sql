-- ==============================================================================
-- MODULE 10 — PHASE 4: FRIENDS-ONLY SOCIAL SYSTEM
-- Migration: MODULE_10_PHASE_4_FRIENDS_ONLY.sql
-- ==============================================================================
-- Scope:
--   1. Lightweight RPC: get_my_friends_count() -> Exact authoritative count of accepted friends
--   2. Update RPC: get_public_profile(p_username TEXT)
--      - Removes followers_count, following_count, is_following
--      - Eliminates all queries on public.user_follows
--      - Retains friends_count, friendship_status, friend_request_id
--   3. Update RPC: search_users(p_query TEXT, p_limit INT, p_offset INT)
--      - Removes is_following and queries on public.user_follows
--      - Includes friendship_status and friend_request_id
--   4. Update RPC: get_my_friends(p_limit INT, p_offset INT)
--      - Removes is_following from response
--      - Eliminates user_follows query
--   5. Update RPC: get_incoming_friend_requests(p_limit INT, p_offset INT)
--      - Removes sender.is_following
--      - Eliminates user_follows query
--   6. Update RPC: get_relationship_status(p_target_user_id UUID)
--      - Removes is_following and is_follower
--      - Eliminates user_follows query
--   7. Deprecation Notice: Legacy Follow RPCs (toggle_follow_user, get_user_followers, get_user_following)
--      - Under safety policy, public.user_follows is preserved unused.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. LIGHTWEIGHT RPC: public.get_my_friends_count
-- Returns exact integer count of accepted friends for authenticated caller
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_friends_count()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_count INT := 0;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Authentication required.',
      'count', 0
    );
  END IF;

  SELECT COUNT(*)::INT INTO v_count
  FROM public.friendships f
  JOIN public.profiles p ON p.id = (CASE WHEN f.sender_id = v_caller_id THEN f.receiver_id ELSE f.sender_id END)
  WHERE f.status = 'accepted'
    AND (f.sender_id = v_caller_id OR f.receiver_id = v_caller_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = v_caller_id)
    );

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_friends_count() TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 2. UPDATE RPC: public.get_public_profile
-- Friends-only public profile: strips followers/following and user_follows queries
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
  v_friends_count INT := 0;
  v_is_blocked_by_caller BOOLEAN := FALSE;
  v_friendship_status TEXT := 'none';
  v_friend_request_id UUID := NULL;
  v_friendship RECORD;
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

  -- 2. Mutual Block Check
  IF v_caller_id IS NOT NULL AND v_caller_id <> v_target.id THEN
    IF EXISTS (
      SELECT 1 FROM public.user_blocks 
      WHERE (blocker_id = v_caller_id AND blocked_id = v_target.id)
         OR (blocker_id = v_target.id AND blocked_id = v_caller_id)
    ) THEN
      IF EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_id = v_caller_id AND blocked_id = v_target.id) THEN
        v_is_blocked_by_caller := TRUE;
      ELSE
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

  -- 4. Daily challenge & contest XP
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

  -- Streak
  SELECT COALESCE(current_streak, 0) INTO v_current_streak
  FROM public.user_streaks
  WHERE user_id = v_target.id;

  -- Level Progression
  v_prog := public.calculate_level_progress(v_total_xp);

  -- Global Rank
  v_rank_res := public.get_user_global_rank(v_target.id);
  IF (v_rank_res->>'found')::boolean = true THEN
    v_rank := (v_rank_res->>'rank')::int;
  END IF;

  -- 5. Friends Count (excluding mutual blocks)
  SELECT COUNT(*) INTO v_friends_count
  FROM public.friendships f
  WHERE f.status = 'accepted'
    AND (f.sender_id = v_target.id OR f.receiver_id = v_target.id)
    AND (
      v_caller_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_caller_id AND b.blocked_id = (CASE WHEN f.sender_id = v_target.id THEN f.receiver_id ELSE f.sender_id END))
           OR (b.blocker_id = (CASE WHEN f.sender_id = v_target.id THEN f.receiver_id ELSE f.sender_id END) AND b.blocked_id = v_caller_id)
      )
    );

  -- 6. Friendship State with Caller
  IF v_caller_id IS NOT NULL AND v_caller_id <> v_target.id THEN
    SELECT id, sender_id, receiver_id, status
    INTO v_friendship
    FROM public.friendships
    WHERE (sender_id = v_caller_id AND receiver_id = v_target.id)
       OR (sender_id = v_target.id AND receiver_id = v_caller_id);

    IF v_friendship.id IS NOT NULL THEN
      IF v_friendship.status = 'accepted' THEN
        v_friendship_status := 'friend';
        v_friend_request_id := v_friendship.id;
      ELSIF v_friendship.status = 'pending' THEN
        v_friend_request_id := v_friendship.id;
        IF v_friendship.sender_id = v_caller_id THEN
          v_friendship_status := 'outgoing_pending';
        ELSE
          v_friendship_status := 'incoming_pending';
        END IF;
      END IF;
    END IF;
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
      'level', (v_prog->>'level')::int,
      'level_title', (v_prog->>'title'),
      'current_level_xp', (v_prog->>'current_level_xp')::bigint,
      'next_level_xp', (v_prog->>'next_level_xp')::bigint,
      'xp_in_level', (v_prog->>'xp_in_level')::bigint,
      'xp_required', (v_prog->>'xp_required')::bigint,
      'progress_percentage', (v_prog->>'progress_percentage')::numeric,
      'rank', v_rank,
      'total_attempts', v_total_attempts,
      'correct_attempts', v_correct_attempts,
      'wrong_attempts', v_wrong_attempts,
      'accuracy_percentage', v_accuracy,
      'solved_count', v_solved_count,
      'contests_count', v_contests_count,
      'current_streak', v_current_streak,
      'friends_count', v_friends_count,
      'is_caller', (v_caller_id = v_target.id),
      'is_blocked_by_caller', v_is_blocked_by_caller,
      'friendship_status', v_friendship_status,
      'friend_request_id', v_friend_request_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. UPDATE RPC: public.search_users
-- Friends-only search: removes is_following and provides friendship_status & friend_request_id
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
        WHEN v_caller_id IS NULL OR v_caller_id = fp.id THEN 'none'
        WHEN EXISTS (
          SELECT 1 FROM public.friendships f 
          WHERE f.status = 'accepted' AND ((f.sender_id = v_caller_id AND f.receiver_id = fp.id) OR (f.sender_id = fp.id AND f.receiver_id = v_caller_id))
        ) THEN 'friend'
        WHEN EXISTS (
          SELECT 1 FROM public.friendships f 
          WHERE f.status = 'pending' AND f.sender_id = v_caller_id AND f.receiver_id = fp.id
        ) THEN 'outgoing_pending'
        WHEN EXISTS (
          SELECT 1 FROM public.friendships f 
          WHERE f.status = 'pending' AND f.sender_id = fp.id AND f.receiver_id = v_caller_id
        ) THEN 'incoming_pending'
        ELSE 'none'
      END AS friendship_status,
      (
        SELECT f.id FROM public.friendships f
        WHERE ((f.sender_id = v_caller_id AND f.receiver_id = fp.id) OR (f.sender_id = fp.id AND f.receiver_id = v_caller_id))
        LIMIT 1
      ) AS friend_request_id
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
      'friendship_status', ur.friendship_status,
      'friend_request_id', ur.friend_request_id,
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
-- 4. UPDATE RPC: public.get_my_friends
-- Friends-only friends list: removes is_following and user_follows query
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_friends(
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
  v_total INT := 0;
  v_friends JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.', 'friends', '[]'::jsonb);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  -- Count total non-blocked friends
  SELECT COUNT(*) INTO v_total
  FROM public.friendships f
  JOIN public.profiles p ON p.id = (CASE WHEN f.sender_id = v_caller_id THEN f.receiver_id ELSE f.sender_id END)
  WHERE f.status = 'accepted'
    AND (f.sender_id = v_caller_id OR f.receiver_id = v_caller_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p.id)
         OR (b.blocker_id = p.id AND b.blocked_id = v_caller_id)
    );

  WITH active_friends AS (
    SELECT 
      p.id,
      p.username,
      COALESCE(p.display_name, p.username) AS display_name,
      p.avatar_url,
      p.bio,
      f.id AS friendship_id,
      f.updated_at AS friends_since
    FROM public.friendships f
    JOIN public.profiles p ON p.id = (CASE WHEN f.sender_id = v_caller_id THEN f.receiver_id ELSE f.sender_id END)
    WHERE f.status = 'accepted'
      AND (f.sender_id = v_caller_id OR f.receiver_id = v_caller_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p.id)
           OR (b.blocker_id = p.id AND b.blocked_id = v_caller_id)
      )
    ORDER BY f.updated_at DESC
    LIMIT v_limit OFFSET v_offset
  ),
  aggregated_friends AS (
    SELECT 
      af.id,
      af.username,
      af.display_name,
      af.avatar_url,
      af.bio,
      af.friendship_id,
      af.friends_since,
      COALESCE((
        SELECT COUNT(DISTINCT question_id) 
        FROM public.user_question_attempts 
        WHERE user_id = af.id AND is_correct = TRUE
      ), 0) AS solved_count,
      GREATEST(0::bigint,
        COALESCE((SELECT SUM(xp_change) FROM public.user_question_attempts WHERE user_id = af.id), 0::bigint) +
        COALESCE((SELECT SUM(bonus_xp_awarded) FROM public.user_daily_challenge_completions WHERE user_id = af.id), 0::bigint) +
        COALESCE((SELECT SUM(xp_awarded) FROM public.contest_participants WHERE user_id = af.id AND status = 'completed'), 0::bigint)
      ) AS total_xp
    FROM active_friends af
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', f.id,
      'username', f.username,
      'display_name', f.display_name,
      'avatar_url', f.avatar_url,
      'bio', f.bio,
      'level', (public.calculate_level_progress(f.total_xp)->>'level')::int,
      'level_title', (public.calculate_level_progress(f.total_xp)->>'title'),
      'total_xp', f.total_xp,
      'solved_count', f.solved_count,
      'friendship_id', f.friendship_id,
      'friends_since', f.friends_since
    )
  ) INTO v_friends
  FROM aggregated_friends f;

  RETURN jsonb_build_object(
    'success', true,
    'friends', COALESCE(v_friends, '[]'::jsonb),
    'total_count', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_friends(INT, INT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. UPDATE RPC: public.get_incoming_friend_requests
-- Friends-only request list: removes sender.is_following and user_follows query
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_incoming_friend_requests(
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
  v_total INT := 0;
  v_requests JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.', 'requests', '[]'::jsonb);
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  SELECT COUNT(*) INTO v_total
  FROM public.friendships f
  JOIN public.profiles p ON p.id = f.sender_id
  WHERE f.receiver_id = v_caller_id
    AND f.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = v_caller_id AND b.blocked_id = f.sender_id)
         OR (b.blocker_id = f.sender_id AND b.blocked_id = v_caller_id)
    );

  WITH incoming_rows AS (
    SELECT 
      f.id AS request_id,
      f.created_at,
      p.id AS sender_id,
      p.username,
      COALESCE(p.display_name, p.username) AS display_name,
      p.avatar_url,
      p.bio
    FROM public.friendships f
    JOIN public.profiles p ON p.id = f.sender_id
    WHERE f.receiver_id = v_caller_id
      AND f.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_caller_id AND b.blocked_id = f.sender_id)
           OR (b.blocker_id = f.sender_id AND b.blocked_id = v_caller_id)
      )
    ORDER BY f.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ),
  aggregated_rows AS (
    SELECT 
      ir.request_id,
      ir.created_at,
      ir.sender_id,
      ir.username,
      ir.display_name,
      ir.avatar_url,
      ir.bio,
      COALESCE((
        SELECT COUNT(DISTINCT question_id) 
        FROM public.user_question_attempts 
        WHERE user_id = ir.sender_id AND is_correct = TRUE
      ), 0) AS solved_count,
      GREATEST(0::bigint,
        COALESCE((SELECT SUM(xp_change) FROM public.user_question_attempts WHERE user_id = ir.sender_id), 0::bigint) +
        COALESCE((SELECT SUM(bonus_xp_awarded) FROM public.user_daily_challenge_completions WHERE user_id = ir.sender_id), 0::bigint) +
        COALESCE((SELECT SUM(xp_awarded) FROM public.contest_participants WHERE user_id = ir.sender_id AND status = 'completed'), 0::bigint)
      ) AS total_xp
    FROM incoming_rows ir
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'request_id', ar.request_id,
      'created_at', ar.created_at,
      'sender', jsonb_build_object(
        'id', ar.sender_id,
        'username', ar.username,
        'display_name', ar.display_name,
        'avatar_url', ar.avatar_url,
        'bio', ar.bio,
        'solved_count', ar.solved_count,
        'total_xp', ar.total_xp,
        'level', (public.calculate_level_progress(ar.total_xp)->>'level')::int,
        'level_title', (public.calculate_level_progress(ar.total_xp)->>'title')
      )
    )
  ) INTO v_requests
  FROM aggregated_rows ar;

  RETURN jsonb_build_object(
    'success', true,
    'requests', COALESCE(v_requests, '[]'::jsonb),
    'total_count', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_incoming_friend_requests(INT, INT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. UPDATE RPC: public.get_relationship_status
-- Friends-only relationship: strips is_following and is_follower
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_relationship_status(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_blocked_by_caller BOOLEAN := FALSE;
  v_is_blocked_by_target BOOLEAN := FALSE;
  v_friend_status TEXT := 'none';
  v_friend_request_id UUID := NULL;
  v_friendship RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'is_caller', false,
      'friend_status', 'none',
      'friend_request_id', NULL,
      'is_blocked', false,
      'error', 'UNAUTHORIZED',
      'message', 'Authentication required.'
    );
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_caller', true,
      'friend_status', 'none',
      'friend_request_id', NULL,
      'is_blocked', false
    );
  END IF;

  -- Block status
  SELECT EXISTS(SELECT 1 FROM public.user_blocks WHERE blocker_id = v_caller_id AND blocked_id = p_target_user_id),
         EXISTS(SELECT 1 FROM public.user_blocks WHERE blocker_id = p_target_user_id AND blocked_id = v_caller_id)
  INTO v_is_blocked_by_caller, v_is_blocked_by_target;

  IF v_is_blocked_by_target THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_caller', false,
      'friend_status', 'unavailable',
      'is_blocked', true
    );
  END IF;

  IF v_is_blocked_by_caller THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_caller', false,
      'friend_status', 'blocked',
      'is_blocked', true
    );
  END IF;

  -- Friendship status
  SELECT id, sender_id, receiver_id, status
  INTO v_friendship
  FROM public.friendships
  WHERE (sender_id = v_caller_id AND receiver_id = p_target_user_id)
     OR (sender_id = p_target_user_id AND receiver_id = v_caller_id);

  IF v_friendship.id IS NOT NULL THEN
    IF v_friendship.status = 'accepted' THEN
      v_friend_status := 'friend';
      v_friend_request_id := v_friendship.id;
    ELSIF v_friendship.status = 'pending' THEN
      v_friend_request_id := v_friendship.id;
      IF v_friendship.sender_id = v_caller_id THEN
        v_friend_status := 'outgoing_pending';
      ELSE
        v_friend_status := 'incoming_pending';
      END IF;
    ELSE
      v_friend_status := 'none';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'is_caller', false,
    'friend_status', v_friend_status,
    'friend_request_id', v_friend_request_id,
    'is_blocked', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_relationship_status(UUID) TO authenticated, anon, service_role;


-- ------------------------------------------------------------------------------
-- 7. DEPRECATION NOTICE: LEGACY FOLLOW INFRASTRUCTURE
-- ------------------------------------------------------------------------------
-- The following RPCs are marked DEPRECATED under Phase 4 and are no longer called
-- by any active frontend component or service:
--   - public.toggle_follow_user(UUID)
--   - public.get_user_followers(UUID, INT, INT)
--   - public.get_user_following(UUID, INT, INT)
-- Under the strict Phase 4 safety rules, public.user_follows and legacy data are
-- preserved without destructive dropping to maintain backwards database stability.
-- ------------------------------------------------------------------------------
COMMENT ON FUNCTION public.toggle_follow_user(UUID) IS 'DEPRECATED: Follow system removed in Phase 4. Use friendship RPCs instead.';
COMMENT ON FUNCTION public.get_user_followers(UUID, INT, INT) IS 'DEPRECATED: Follow system removed in Phase 4. Use get_my_friends instead.';
COMMENT ON FUNCTION public.get_user_following(UUID, INT, INT) IS 'DEPRECATED: Follow system removed in Phase 4. Use get_my_friends instead.';
