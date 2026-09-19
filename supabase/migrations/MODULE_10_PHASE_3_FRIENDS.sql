-- ==============================================================================
-- MODULE 10 — PHASE 3: FRIENDS SYSTEM & FRIEND REQUESTS
-- Migration: MODULE_10_PHASE_3_FRIENDS.sql
-- ==============================================================================
-- Scope:
--   1. RLS Hardening on public.friendships (drop direct client mutations)
--   2. Integrity Trigger: check_friendship_block_restriction
--   3. RPC: send_friend_request(target_user_id)
--   4. RPC: respond_to_friend_request(request_id, action)
--   5. RPC: cancel_friend_request(request_id)
--   6. RPC: remove_friend(target_user_id)
--   7. RPC: get_my_friends(limit, offset)
--   8. RPC: get_incoming_friend_requests(limit, offset)
--   9. RPC: get_outgoing_friend_requests(limit, offset)
--  10. RPC: get_relationship_status(target_user_id)
--  11. Enhanced RPC: get_public_profile(username) with friendship telemetry
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RLS HARDENING: DROP DIRECT CLIENT MUTATIONS ON friendships
-- ------------------------------------------------------------------------------
-- All friendship creations, status updates, and deletions must flow through
-- server-authoritative SECURITY DEFINER RPCs to prevent client tampering.

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
DROP POLICY IF EXISTS "Receivers can update friendship status" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete their own friendships" ON public.friendships;

-- Ensure SELECT policy remains intact for caller visibility
DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);


-- ------------------------------------------------------------------------------
-- 2. TRIGGER: check_friendship_block_restriction
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_friendship_block_restriction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = NEW.sender_id AND b.blocked_id = NEW.receiver_id)
       OR (b.blocker_id = NEW.receiver_id AND b.blocked_id = NEW.sender_id)
  ) THEN
    RAISE EXCEPTION 'Cannot create or modify friendship between blocked users.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friendship_block_check ON public.friendships;
CREATE TRIGGER trg_friendship_block_check
  BEFORE INSERT OR UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.check_friendship_block_restriction();


-- ------------------------------------------------------------------------------
-- 3. RPC: send_friend_request
-- Server-authoritative friend request dispatch with notification creation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_friend_request(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_username TEXT;
  v_caller_display TEXT;
  v_target RECORD;
  v_existing RECORD;
  v_request_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_REQUEST', 'message', 'Cannot send a friend request to yourself.');
  END IF;

  -- Verify target user exists
  SELECT id, username, display_name
  INTO v_target
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND', 'message', 'Competitor not found.');
  END IF;

  -- Verify mutual block restrictions
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = v_caller_id AND blocked_id = p_target_user_id)
       OR (blocker_id = p_target_user_id AND blocked_id = v_caller_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'BLOCKED', 'message', 'Cannot send friend request to this competitor.');
  END IF;

  -- Fetch caller display info
  SELECT username, COALESCE(display_name, username)
  INTO v_caller_username, v_caller_display
  FROM public.profiles
  WHERE id = v_caller_id;

  -- Check existing friendship/request row (lock row to serialize concurrent attempts)
  SELECT id, sender_id, receiver_id, status
  INTO v_existing
  FROM public.friendships
  WHERE (sender_id = v_caller_id AND receiver_id = p_target_user_id)
     OR (sender_id = p_target_user_id AND receiver_id = v_caller_id)
  FOR UPDATE;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.status = 'accepted' THEN
      RETURN jsonb_build_object('success', false, 'error', 'ALREADY_FRIENDS', 'message', 'You are already friends with this competitor.');
    ELSIF v_existing.status = 'pending' THEN
      IF v_existing.sender_id = v_caller_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'REQUEST_ALREADY_PENDING', 'message', 'Friend request already sent and pending.');
      ELSE
        RETURN jsonb_build_object('success', false, 'error', 'REVERSE_REQUEST_PENDING', 'message', 'This competitor has already sent you a friend request. Please accept it instead.');
      END IF;
    ELSIF v_existing.status = 'rejected' THEN
      -- Re-activate the previously rejected request with caller as sender
      UPDATE public.friendships
      SET sender_id = v_caller_id,
          receiver_id = p_target_user_id,
          status = 'pending',
          created_at = NOW(),
          updated_at = NOW()
      WHERE id = v_existing.id
      RETURNING id INTO v_request_id;
    END IF;
  ELSE
    -- Fresh request
    INSERT INTO public.friendships (sender_id, receiver_id, status)
    VALUES (v_caller_id, p_target_user_id, 'pending')
    RETURNING id INTO v_request_id;
  END IF;

  -- Create system notification for recipient
  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    title,
    message,
    data
  ) VALUES (
    p_target_user_id,
    v_caller_id,
    'friend_request',
    'New Friend Request',
    v_caller_display || ' sent you a friend request.',
    jsonb_build_object(
      'request_id', v_request_id,
      'sender_id', v_caller_id,
      'username', v_caller_username
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'status', 'pending',
    'message', 'Friend request sent successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. RPC: respond_to_friend_request
-- Server-authoritative friend request acceptance or rejection
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_friend_request(
  p_request_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_display TEXT;
  v_caller_username TEXT;
  v_clean_action TEXT;
  v_req RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  v_clean_action := lower(trim(p_action));
  IF v_clean_action NOT IN ('accept', 'reject') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION', 'message', 'Action must be accept or reject.');
  END IF;

  -- Lock and inspect request
  SELECT id, sender_id, receiver_id, status
  INTO v_req
  FROM public.friendships
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Friend request not found.');
  END IF;

  -- Only recipient can accept or reject
  IF v_req.receiver_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Only the recipient can respond to this friend request.');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_PENDING', 'message', 'Friend request is no longer pending.');
  END IF;

  -- Check block restrictions
  IF EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = v_caller_id AND blocked_id = v_req.sender_id)
       OR (blocker_id = v_req.sender_id AND blocked_id = v_caller_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'BLOCKED', 'message', 'Cannot respond to friend request from a blocked user.');
  END IF;

  SELECT username, COALESCE(display_name, username)
  INTO v_caller_username, v_caller_display
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_clean_action = 'accept' THEN
    UPDATE public.friendships
    SET status = 'accepted',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Notification for the requester that their request was accepted
    INSERT INTO public.notifications (
      user_id,
      actor_id,
      type,
      title,
      message,
      data
    ) VALUES (
      v_req.sender_id,
      v_caller_id,
      'friend_accepted',
      'Friend Request Accepted',
      v_caller_display || ' accepted your friend request.',
      jsonb_build_object(
        'friendship_id', p_request_id,
        'user_id', v_caller_id,
        'username', v_caller_username
      )
    );

    -- Mark related incoming friend_request notifications as read
    UPDATE public.notifications
    SET is_read = TRUE
    WHERE user_id = v_caller_id
      AND actor_id = v_req.sender_id
      AND type = 'friend_request';

    RETURN jsonb_build_object(
      'success', true,
      'status', 'accepted',
      'message', 'Friend request accepted.'
    );
  ELSE
    -- Action: reject
    UPDATE public.friendships
    SET status = 'rejected',
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Mark incoming friend_request notifications as read
    UPDATE public.notifications
    SET is_read = TRUE
    WHERE user_id = v_caller_id
      AND actor_id = v_req.sender_id
      AND type = 'friend_request';

    RETURN jsonb_build_object(
      'success', true,
      'status', 'rejected',
      'message', 'Friend request rejected.'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_friend_request(UUID, TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. RPC: cancel_friend_request
-- Only sender can cancel their own pending outgoing request
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_friend_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_req RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT id, sender_id, receiver_id, status
  INTO v_req
  FROM public.friendships
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_req.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Friend request not found.');
  END IF;

  IF v_req.sender_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Only the sender can cancel this friend request.');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_PENDING', 'message', 'Friend request is no longer pending.');
  END IF;

  DELETE FROM public.friendships WHERE id = p_request_id;

  -- Clean up pending notification sent to receiver
  DELETE FROM public.notifications
  WHERE user_id = v_req.receiver_id
    AND actor_id = v_caller_id
    AND type = 'friend_request';

  RETURN jsonb_build_object('success', true, 'message', 'Friend request cancelled.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_friend_request(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. RPC: remove_friend
-- Atomic friendship removal (follow relationships remain intact)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_friend(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_row_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_REMOVE', 'message', 'Cannot remove yourself as a friend.');
  END IF;

  SELECT id INTO v_row_id
  FROM public.friendships
  WHERE status = 'accepted'
    AND ((sender_id = v_caller_id AND receiver_id = p_target_user_id)
      OR (sender_id = p_target_user_id AND receiver_id = v_caller_id))
  FOR UPDATE;

  IF v_row_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FRIENDS', 'message', 'No active friendship found with this competitor.');
  END IF;

  DELETE FROM public.friendships WHERE id = v_row_id;

  RETURN jsonb_build_object('success', true, 'message', 'Friend removed successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_friend(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 7. RPC: get_my_friends
-- Paginated list of accepted friends with verified public profile telemetry
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
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_total INT := 0;
  v_friends JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.', 'friends', '[]'::jsonb);
  END IF;

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
      f.updated_at AS friends_since,
      EXISTS (
        SELECT 1 FROM public.user_follows uf
        WHERE uf.follower_id = v_caller_id AND uf.following_id = p.id
      ) AS is_following
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
      af.is_following,
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
      'id', ag.id,
      'username', ag.username,
      'display_name', ag.display_name,
      'avatar_url', ag.avatar_url,
      'bio', ag.bio,
      'friendship_id', ag.friendship_id,
      'friends_since', ag.friends_since,
      'is_following', ag.is_following,
      'solved_count', ag.solved_count,
      'total_xp', ag.total_xp,
      'level', (public.calculate_level_progress(ag.total_xp)->>'level')::int,
      'level_title', (public.calculate_level_progress(ag.total_xp)->>'title')
    )
  ) INTO v_friends
  FROM aggregated_friends ag;

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
-- 8. RPC: get_incoming_friend_requests
-- Paginated list of incoming pending friend requests
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
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_total INT := 0;
  v_requests JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.', 'requests', '[]'::jsonb);
  END IF;

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
      p.bio,
      EXISTS (
        SELECT 1 FROM public.user_follows uf
        WHERE uf.follower_id = v_caller_id AND uf.following_id = p.id
      ) AS is_following
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
      ir.is_following,
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
        'is_following', ar.is_following,
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
-- 9. RPC: get_outgoing_friend_requests
-- Paginated list of outgoing pending friend requests
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_outgoing_friend_requests(
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
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_total INT := 0;
  v_requests JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.', 'requests', '[]'::jsonb);
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.friendships f
  JOIN public.profiles p ON p.id = f.receiver_id
  WHERE f.sender_id = v_caller_id
    AND f.status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = v_caller_id AND b.blocked_id = f.receiver_id)
         OR (b.blocker_id = f.receiver_id AND b.blocked_id = v_caller_id)
    );

  WITH outgoing_rows AS (
    SELECT 
      f.id AS request_id,
      f.created_at,
      p.id AS recipient_id,
      p.username,
      COALESCE(p.display_name, p.username) AS display_name,
      p.avatar_url,
      p.bio
    FROM public.friendships f
    JOIN public.profiles p ON p.id = f.receiver_id
    WHERE f.sender_id = v_caller_id
      AND f.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_blocks b
        WHERE (b.blocker_id = v_caller_id AND b.blocked_id = f.receiver_id)
           OR (b.blocker_id = f.receiver_id AND b.blocked_id = v_caller_id)
      )
    ORDER BY f.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ),
  aggregated_rows AS (
    SELECT 
      ogr.request_id,
      ogr.created_at,
      ogr.recipient_id,
      ogr.username,
      ogr.display_name,
      ogr.avatar_url,
      ogr.bio,
      COALESCE((
        SELECT COUNT(DISTINCT question_id) 
        FROM public.user_question_attempts 
        WHERE user_id = ogr.recipient_id AND is_correct = TRUE
      ), 0) AS solved_count,
      GREATEST(0::bigint,
        COALESCE((SELECT SUM(xp_change) FROM public.user_question_attempts WHERE user_id = ogr.recipient_id), 0::bigint) +
        COALESCE((SELECT SUM(bonus_xp_awarded) FROM public.user_daily_challenge_completions WHERE user_id = ogr.recipient_id), 0::bigint) +
        COALESCE((SELECT SUM(xp_awarded) FROM public.contest_participants WHERE user_id = ogr.recipient_id AND status = 'completed'), 0::bigint)
      ) AS total_xp
    FROM outgoing_rows ogr
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'request_id', ar.request_id,
      'created_at', ar.created_at,
      'recipient', jsonb_build_object(
        'id', ar.recipient_id,
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

GRANT EXECUTE ON FUNCTION public.get_outgoing_friend_requests(INT, INT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 10. RPC: get_relationship_status
-- Server-authoritative relationship state between caller and target user
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
  v_is_caller BOOLEAN := FALSE;
  v_is_following BOOLEAN := FALSE;
  v_is_follower BOOLEAN := FALSE;
  v_is_blocked_by_caller BOOLEAN := FALSE;
  v_is_blocked_by_target BOOLEAN := FALSE;
  v_friendship RECORD;
  v_friend_status TEXT := 'none';
  v_friend_request_id UUID := NULL;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_caller', false,
      'friend_status', 'none',
      'is_following', false,
      'is_follower', false,
      'is_blocked', false
    );
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_caller', true,
      'friend_status', 'none',
      'is_following', false,
      'is_follower', false,
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
      'is_following', false,
      'is_follower', false,
      'is_blocked', true
    );
  END IF;

  IF v_is_blocked_by_caller THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_caller', false,
      'friend_status', 'blocked',
      'is_following', false,
      'is_follower', false,
      'is_blocked', true
    );
  END IF;

  -- Follow status
  v_is_following := EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id = v_caller_id AND following_id = p_target_user_id);
  v_is_follower := EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id = p_target_user_id AND following_id = v_caller_id);

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
    'is_following', v_is_following,
    'is_follower', v_is_follower,
    'is_blocked', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_relationship_status(UUID) TO authenticated, anon, service_role;


-- ------------------------------------------------------------------------------
-- 11. ENHANCED RPC: get_public_profile
-- Adds friendship status, friend request ID, and friends count to public profile
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
  v_friends_count INT := 0;
  v_is_following BOOLEAN := FALSE;
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

  -- Social Counts (excluding blocked)
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

  -- Follow State
  IF v_caller_id IS NOT NULL AND v_caller_id <> v_target.id THEN
    v_is_following := EXISTS (
      SELECT 1 FROM public.user_follows 
      WHERE follower_id = v_caller_id AND following_id = v_target.id
    );

    -- Friendship State
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
      'followers_count', v_followers_count,
      'following_count', v_following_count,
      'friends_count', v_friends_count,
      'is_caller', (v_caller_id = v_target.id),
      'is_following', v_is_following,
      'is_blocked_by_caller', v_is_blocked_by_caller,
      'friendship_status', v_friendship_status,
      'friend_request_id', v_friend_request_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile(TEXT) TO anon, authenticated, service_role;
