-- ==============================================================================
-- MODULE 10 — PHASE 4: 1v1 MATCHMAKING ENGINE & CHALLENGE LIFECYCLE
-- Migration: MODULE_10_PHASE_4_1V1_MATCHMAKING.sql
-- ==============================================================================
-- Scope:
--   1. Queue Table: public.matchmaking_queue (dedicated concurrency-safe queue)
--   2. Status Check Alignment: support 'pending' and 'waiting' on public.matches_1v1
--   3. Realtime Publication: add public.matchmaking_queue to supabase_realtime
--   4. RLS Hardening: drop direct client mutations, enforce participant access
--   5. RPC: create_1v1_challenge(target_user_id, category, question_count, time_per_question_seconds)
--   6. RPC: respond_1v1_challenge(match_id, action) ['accept' | 'decline']
--   7. RPC: cancel_1v1_challenge(match_id)
--   8. RPC: start_1v1_match(match_id)
--   9. RPC: join_matchmaking_queue(category, question_count, time_per_question_seconds)
--  10. RPC: leave_matchmaking_queue()
--  11. RPC: get_1v1_match(match_id)
--  12. RPC: get_1v1_match_questions(match_id) (ZERO LEAK QUESTION DELIVERY)
--  13. RPC: get_my_1v1_challenges(limit, offset)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. QUEUE TABLE: public.matchmaking_queue
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'All Topics',
  question_count INTEGER NOT NULL DEFAULT 5 CHECK (question_count IN (3, 5, 10)),
  time_per_question_seconds INTEGER NOT NULL DEFAULT 60 CHECK (time_per_question_seconds BETWEEN 30 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_created ON public.matchmaking_queue(created_at ASC);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own queue entry" ON public.matchmaking_queue;
CREATE POLICY "Users can view their own queue entry"
  ON public.matchmaking_queue FOR SELECT
  USING (auth.uid() = user_id);

-- Direct client mutations denied (managed exclusively via join/leave RPCs).


-- ------------------------------------------------------------------------------
-- 2. STATUS CHECK ALIGNMENT ON public.matches_1v1
-- ------------------------------------------------------------------------------
ALTER TABLE public.matches_1v1 DROP CONSTRAINT IF EXISTS matches_1v1_status_check;
ALTER TABLE public.matches_1v1 ADD CONSTRAINT matches_1v1_status_check CHECK (
  status IN (
    'pending',
    'waiting',
    'accepted',
    'in_progress',
    'completed',
    'declined',
    'cancelled',
    'abandoned'
  )
);


-- ------------------------------------------------------------------------------
-- 3. REALTIME PUBLICATION CONFIGURATION
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'matchmaking_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_queue;
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 4. RLS HARDENING ON matches_1v1, match_1v1_questions, match_1v1_answers
-- ------------------------------------------------------------------------------
-- Ensure only match participants can view matches_1v1
DROP POLICY IF EXISTS "Participants can view their own 1v1 matches" ON public.matches_1v1;
CREATE POLICY "Participants can view their own 1v1 matches"
  ON public.matches_1v1 FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Ensure only match participants can view match_1v1_questions
DROP POLICY IF EXISTS "Match participants can view assigned match questions" ON public.match_1v1_questions;
CREATE POLICY "Match participants can view assigned match questions"
  ON public.match_1v1_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matches_1v1 m
      WHERE m.id = match_1v1_questions.match_id
        AND (m.challenger_id = auth.uid() OR m.opponent_id = auth.uid())
    )
  );

-- Direct client INSERT, UPDATE, DELETE policies remain absent on matches_1v1,
-- match_1v1_questions, and matchmaking_queue, strictly enforcing RPC authority.


-- ------------------------------------------------------------------------------
-- 5. RPC: create_1v1_challenge
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_1v1_challenge(
  p_target_user_id UUID,
  p_category TEXT DEFAULT 'All Topics',
  p_question_count INTEGER DEFAULT 5,
  p_time_per_question_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_username TEXT;
  v_target RECORD;
  v_match_id UUID;
  v_valid_category TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  IF v_caller_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SELF_CHALLENGE', 'message', 'You cannot challenge yourself.');
  END IF;

  -- Validate target user exists
  SELECT id, username, display_name INTO v_target
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND', 'message', 'Target competitor not found.');
  END IF;

  -- Verify caller profile
  SELECT username INTO v_caller_username
  FROM public.profiles
  WHERE id = v_caller_id;

  -- Validate block restrictions in both directions
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = v_caller_id AND b.blocked_id = p_target_user_id)
       OR (b.blocker_id = p_target_user_id AND b.blocked_id = v_caller_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'BLOCKED', 'message', 'Cannot challenge this competitor.');
  END IF;

  -- Validate configuration constraints
  IF p_question_count NOT IN (3, 5, 10) THEN
    p_question_count := 5;
  END IF;

  IF p_time_per_question_seconds < 30 OR p_time_per_question_seconds > 120 THEN
    p_time_per_question_seconds := 60;
  END IF;

  v_valid_category := COALESCE(NULLIF(TRIM(p_category), ''), 'All Topics');

  -- Check if caller already has an active match
  IF EXISTS (
    SELECT 1 FROM public.matches_1v1
    WHERE (challenger_id = v_caller_id OR opponent_id = v_caller_id)
      AND status IN ('in_progress', 'accepted')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACTIVE_MATCH_EXISTS', 'message', 'You already have an active match in progress.');
  END IF;

  -- Check if target user already has an active match in progress
  IF EXISTS (
    SELECT 1 FROM public.matches_1v1
    WHERE (challenger_id = p_target_user_id OR opponent_id = p_target_user_id)
      AND status = 'in_progress'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'OPPONENT_BUSY', 'message', 'Competitor is currently in another match.');
  END IF;

  -- Check if a duplicate pending/waiting challenge already exists between this pair
  IF EXISTS (
    SELECT 1 FROM public.matches_1v1
    WHERE ((challenger_id = v_caller_id AND opponent_id = p_target_user_id)
        OR (challenger_id = p_target_user_id AND opponent_id = v_caller_id))
      AND status IN ('pending', 'waiting')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_CHALLENGE', 'message', 'A pending challenge already exists with this competitor.');
  END IF;

  -- Insert match row
  INSERT INTO public.matches_1v1 (
    challenger_id,
    opponent_id,
    category,
    question_count,
    time_per_question_seconds,
    status,
    expires_at
  ) VALUES (
    v_caller_id,
    p_target_user_id,
    v_valid_category,
    p_question_count,
    p_time_per_question_seconds,
    'pending',
    NOW() + INTERVAL '24 hours'
  ) RETURNING id INTO v_match_id;

  -- Create server notification for target user
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
    'challenge_received',
    '1v1 Challenge Received',
    COALESCE(v_caller_username, 'A competitor') || ' challenged you to a 1v1 battle!',
    jsonb_build_object(
      'match_id', v_match_id,
      'challenger_id', v_caller_id,
      'category', v_valid_category,
      'question_count', p_question_count,
      'time_per_question_seconds', p_time_per_question_seconds
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'match_id', v_match_id,
    'status', 'pending',
    'message', '1v1 challenge issued successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_1v1_challenge(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_1v1_challenge(UUID, TEXT, INTEGER, INTEGER) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. RPC: respond_1v1_challenge
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_1v1_challenge(
  p_match_id UUID,
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
  v_match RECORD;
  v_caller_username TEXT;
  v_q RECORD;
  v_order INTEGER := 1;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  IF p_action NOT IN ('accept', 'decline') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ACTION', 'message', 'Action must be accept or decline.');
  END IF;

  -- Lock match row
  SELECT * INTO v_match
  FROM public.matches_1v1
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_FOUND', 'message', 'Match not found.');
  END IF;

  -- Only opponent can respond to challenge
  IF v_match.opponent_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_ACTION', 'message', 'Only the challenged competitor can respond.');
  END IF;

  -- Must be in pending/waiting state
  IF v_match.status NOT IN ('pending', 'waiting') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATE', 'message', 'Challenge is no longer pending.');
  END IF;

  -- Check blocks
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = v_caller_id AND b.blocked_id = v_match.challenger_id)
       OR (b.blocker_id = v_match.challenger_id AND b.blocked_id = v_caller_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'BLOCKED', 'message', 'Cannot interact with blocked user.');
  END IF;

  SELECT username INTO v_caller_username
  FROM public.profiles
  WHERE id = v_caller_id;

  -- ----------------------------------------------------------------------------
  -- Handle DECLINE
  -- ----------------------------------------------------------------------------
  IF p_action = 'decline' THEN
    UPDATE public.matches_1v1
    SET status = 'declined', updated_at = NOW()
    WHERE id = p_match_id;

    -- Notify challenger
    INSERT INTO public.notifications (
      user_id,
      actor_id,
      type,
      title,
      message,
      data
    ) VALUES (
      v_match.challenger_id,
      v_caller_id,
      'challenge_declined',
      '1v1 Challenge Declined',
      COALESCE(v_caller_username, 'Competitor') || ' declined your 1v1 challenge.',
      jsonb_build_object('match_id', p_match_id)
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'declined',
      'match_id', p_match_id,
      'message', 'Challenge declined.'
    );
  END IF;

  -- ----------------------------------------------------------------------------
  -- Handle ACCEPT
  -- ----------------------------------------------------------------------------
  -- Transition status to accepted
  UPDATE public.matches_1v1
  SET status = 'accepted', updated_at = NOW()
  WHERE id = p_match_id;

  -- Secure question assignment from active questions pool
  -- If category is specific and has enough questions, use category; else fallback to all active
  IF NOT EXISTS (SELECT 1 FROM public.match_1v1_questions WHERE match_id = p_match_id) THEN
    v_order := 1;
    FOR v_q IN (
      SELECT id FROM public.questions
      WHERE is_active = TRUE
        AND (v_match.category = 'All Topics' OR category = v_match.category)
      ORDER BY random()
      LIMIT v_match.question_count
    ) LOOP
      INSERT INTO public.match_1v1_questions (
        match_id,
        question_id,
        order_index
      ) VALUES (
        p_match_id,
        v_q.id,
        v_order
      ) ON CONFLICT (match_id, question_id) DO NOTHING;
      v_order := v_order + 1;
    END LOOP;

    -- If category had fewer questions than required count, top up with random active questions
    IF v_order <= v_match.question_count THEN
      FOR v_q IN (
        SELECT id FROM public.questions
        WHERE is_active = TRUE
          AND id NOT IN (SELECT question_id FROM public.match_1v1_questions WHERE match_id = p_match_id)
        ORDER BY random()
        LIMIT (v_match.question_count - v_order + 1)
      ) LOOP
        INSERT INTO public.match_1v1_questions (
          match_id,
          question_id,
          order_index
        ) VALUES (
          p_match_id,
          v_q.id,
          v_order
        ) ON CONFLICT (match_id, question_id) DO NOTHING;
        v_order := v_order + 1;
      END LOOP;
    END IF;
  END IF;

  -- Notify challenger that challenge was accepted
  INSERT INTO public.notifications (
    user_id,
    actor_id,
    type,
    title,
    message,
    data
  ) VALUES (
    v_match.challenger_id,
    v_caller_id,
    'challenge_accepted',
    '1v1 Challenge Accepted',
    COALESCE(v_caller_username, 'Competitor') || ' accepted your 1v1 challenge! The battle lobby is ready.',
    jsonb_build_object('match_id', p_match_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'accepted',
    'match_id', p_match_id,
    'message', 'Challenge accepted successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.respond_1v1_challenge(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_1v1_challenge(UUID, TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 7. RPC: cancel_1v1_challenge
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_1v1_challenge(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_match
  FROM public.matches_1v1
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_FOUND', 'message', 'Match not found.');
  END IF;

  -- Only challenger can cancel
  IF v_match.challenger_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_ACTION', 'message', 'Only the challenger can cancel this challenge.');
  END IF;

  -- Can only cancel if pending/waiting
  IF v_match.status NOT IN ('pending', 'waiting') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATE', 'message', 'Cannot cancel a challenge that is already ' || v_match.status || '.');
  END IF;

  UPDATE public.matches_1v1
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'cancelled',
    'match_id', p_match_id,
    'message', 'Challenge cancelled.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_1v1_challenge(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_1v1_challenge(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 8. RPC: start_1v1_match
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_1v1_match(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_match
  FROM public.matches_1v1
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_FOUND', 'message', 'Match not found.');
  END IF;

  IF v_match.challenger_id <> v_caller_id AND v_match.opponent_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED_ACTION', 'message', 'You are not a participant in this match.');
  END IF;

  -- If already in_progress, return idempotent success
  IF v_match.status = 'in_progress' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'in_progress',
      'match_id', p_match_id,
      'started_at', v_match.started_at,
      'message', 'Match is already in progress.'
    );
  END IF;

  IF v_match.status <> 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATE', 'message', 'Match is not in accepted state.');
  END IF;

  UPDATE public.matches_1v1
  SET status = 'in_progress',
      started_at = v_now,
      updated_at = v_now
  WHERE id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'in_progress',
    'match_id', p_match_id,
    'started_at', v_now,
    'message', 'Match started.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_1v1_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_1v1_match(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 9. RPC: join_matchmaking_queue
-- Concurrency-safe atomic pairing using FOR UPDATE SKIP LOCKED
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_matchmaking_queue(
  p_category TEXT DEFAULT 'All Topics',
  p_question_count INTEGER DEFAULT 5,
  p_time_per_question_seconds INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_username TEXT;
  v_opponent RECORD;
  v_match_id UUID;
  v_queue_id UUID;
  v_valid_category TEXT;
  v_q RECORD;
  v_order INTEGER := 1;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  -- Reject if caller has an active match in progress or accepted
  IF EXISTS (
    SELECT 1 FROM public.matches_1v1
    WHERE (challenger_id = v_caller_id OR opponent_id = v_caller_id)
      AND status IN ('in_progress', 'accepted')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'ACTIVE_MATCH_EXISTS', 'message', 'Cannot enter queue while in an active match.');
  END IF;

  IF p_question_count NOT IN (3, 5, 10) THEN
    p_question_count := 5;
  END IF;

  IF p_time_per_question_seconds < 30 OR p_time_per_question_seconds > 120 THEN
    p_time_per_question_seconds := 60;
  END IF;

  v_valid_category := COALESCE(NULLIF(TRIM(p_category), ''), 'All Topics');

  SELECT username INTO v_caller_username
  FROM public.profiles
  WHERE id = v_caller_id;

  -- ----------------------------------------------------------------------------
  -- Attempt to pair with an existing queued user (FOR UPDATE SKIP LOCKED)
  -- ----------------------------------------------------------------------------
  SELECT * INTO v_opponent
  FROM public.matchmaking_queue q
  WHERE q.user_id <> v_caller_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = v_caller_id AND b.blocked_id = q.user_id)
         OR (b.blocker_id = q.user_id AND b.blocked_id = v_caller_id)
    )
  ORDER BY q.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_opponent.id IS NOT NULL THEN
    -- Match found! Atomically remove opponent from queue and clean caller if present
    DELETE FROM public.matchmaking_queue WHERE id = v_opponent.id;
    DELETE FROM public.matchmaking_queue WHERE user_id = v_caller_id;

    -- Create match in matches_1v1 (instantly accepted for both queued users)
    INSERT INTO public.matches_1v1 (
      challenger_id,
      opponent_id,
      category,
      question_count,
      time_per_question_seconds,
      status
    ) VALUES (
      v_opponent.user_id,
      v_caller_id,
      v_valid_category,
      p_question_count,
      p_time_per_question_seconds,
      'accepted'
    ) RETURNING id INTO v_match_id;

    -- Populate match questions securely
    v_order := 1;
    FOR v_q IN (
      SELECT id FROM public.questions
      WHERE is_active = TRUE
        AND (v_valid_category = 'All Topics' OR category = v_valid_category)
      ORDER BY random()
      LIMIT p_question_count
    ) LOOP
      INSERT INTO public.match_1v1_questions (
        match_id,
        question_id,
        order_index
      ) VALUES (
        v_match_id,
        v_q.id,
        v_order
      ) ON CONFLICT (match_id, question_id) DO NOTHING;
      v_order := v_order + 1;
    END LOOP;

    -- Fallback fill if category has fewer questions
    IF v_order <= p_question_count THEN
      FOR v_q IN (
        SELECT id FROM public.questions
        WHERE is_active = TRUE
          AND id NOT IN (SELECT question_id FROM public.match_1v1_questions WHERE match_id = v_match_id)
        ORDER BY random()
        LIMIT (p_question_count - v_order + 1)
      ) LOOP
        INSERT INTO public.match_1v1_questions (
          match_id,
          question_id,
          order_index
        ) VALUES (
          v_match_id,
          v_q.id,
          v_order
        ) ON CONFLICT (match_id, question_id) DO NOTHING;
        v_order := v_order + 1;
      END LOOP;
    END IF;

    -- Notify opponent that match was found
    INSERT INTO public.notifications (
      user_id,
      actor_id,
      type,
      title,
      message,
      data
    ) VALUES (
      v_opponent.user_id,
      v_caller_id,
      'match_ready',
      'Match Found!',
      'Matched with @' || COALESCE(v_caller_username, 'competitor') || '! Entering battle lobby.',
      jsonb_build_object('match_id', v_match_id)
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'matched',
      'match_id', v_match_id,
      'message', 'Opponent matched! Entering lobby.'
    );
  END IF;

  -- ----------------------------------------------------------------------------
  -- No opponent found: insert caller into queue (or update existing entry)
  -- ----------------------------------------------------------------------------
  INSERT INTO public.matchmaking_queue (
    user_id,
    category,
    question_count,
    time_per_question_seconds
  ) VALUES (
    v_caller_id,
    v_valid_category,
    p_question_count,
    p_time_per_question_seconds
  )
  ON CONFLICT (user_id) DO UPDATE SET
    category = EXCLUDED.category,
    question_count = EXCLUDED.question_count,
    time_per_question_seconds = EXCLUDED.time_per_question_seconds,
    created_at = NOW()
  RETURNING id INTO v_queue_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'queued',
    'queue_id', v_queue_id,
    'message', 'Searching for an opponent...'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_matchmaking_queue(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_matchmaking_queue(TEXT, INTEGER, INTEGER) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 10. RPC: leave_matchmaking_queue
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_matchmaking_queue()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  DELETE FROM public.matchmaking_queue
  WHERE user_id = v_caller_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'left',
    'message', 'Left matchmaking queue.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leave_matchmaking_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_matchmaking_queue() TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 10.5 HELPER: get_user_total_xp
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
    COALESCE((SELECT SUM(xp_awarded) FROM public.contest_participants WHERE user_id = p_user_id AND status = 'completed'), 0::bigint)
  );
$$;

REVOKE ALL ON FUNCTION public.get_user_total_xp(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_total_xp(UUID) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 11. RPC: get_1v1_match
-- Returns safe participant and match metadata without answer leakage
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_1v1_match(p_match_id UUID)
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
  v_challenger_prog JSONB;
  v_opponent_prog JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_match
  FROM public.matches_1v1
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_FOUND', 'message', 'Match not found.');
  END IF;

  -- Participant authorization
  IF v_match.challenger_id <> v_caller_id AND v_match.opponent_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_PARTICIPANT', 'message', 'You do not have access to this match.');
  END IF;

  -- Fetch challenger profile and level progress
  SELECT p.id, p.username, p.display_name, p.avatar_url, public.get_user_total_xp(p.id) AS total_xp
  INTO v_challenger
  FROM public.profiles p
  WHERE p.id = v_match.challenger_id;

  v_challenger_prog := public.calculate_level_progress(COALESCE(v_challenger.total_xp, 0));

  -- Fetch opponent profile and level progress
  SELECT p.id, p.username, p.display_name, p.avatar_url, public.get_user_total_xp(p.id) AS total_xp
  INTO v_opponent
  FROM public.profiles p
  WHERE p.id = v_match.opponent_id;

  v_opponent_prog := public.calculate_level_progress(COALESCE(v_opponent.total_xp, 0));

  RETURN jsonb_build_object(
    'success', true,
    'match', jsonb_build_object(
      'id', v_match.id,
      'status', v_match.status,
      'category', v_match.category,
      'question_count', v_match.question_count,
      'time_per_question_seconds', v_match.time_per_question_seconds,
      'started_at', v_match.started_at,
      'completed_at', v_match.completed_at,
      'expires_at', v_match.expires_at,
      'created_at', v_match.created_at,
      'is_caller_challenger', (v_match.challenger_id = v_caller_id),
      'challenger', jsonb_build_object(
        'id', v_challenger.id,
        'username', v_challenger.username,
        'display_name', v_challenger.display_name,
        'avatar_url', v_challenger.avatar_url,
        'level', (v_challenger_prog->>'level')::int,
        'level_title', (v_challenger_prog->>'title')
      ),
      'opponent', jsonb_build_object(
        'id', v_opponent.id,
        'username', v_opponent.username,
        'display_name', v_opponent.display_name,
        'avatar_url', v_opponent.avatar_url,
        'level', (v_opponent_prog->>'level')::int,
        'level_title', (v_opponent_prog->>'title')
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_1v1_match(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_1v1_match(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 12. RPC: get_1v1_match_questions
-- CRITICAL ANTI-CHEAT: Delivers ordered questions WITHOUT correct_option or explanation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_1v1_match_questions(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
  v_questions_json JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_match
  FROM public.matches_1v1
  WHERE id = p_match_id;

  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_FOUND', 'message', 'Match not found.');
  END IF;

  -- Only participants can retrieve questions
  IF v_match.challenger_id <> v_caller_id AND v_match.opponent_id <> v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_PARTICIPANT', 'message', 'You are not a participant in this match.');
  END IF;

  -- Questions can only be viewed once accepted, in_progress, or completed
  IF v_match.status NOT IN ('accepted', 'in_progress', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'MATCH_NOT_READY', 'message', 'Questions are not available until match is accepted.');
  END IF;

  -- Fetch questions ordered strictly by order_index, stripping correct_option and explanation
  SELECT jsonb_agg(
    jsonb_build_object(
      'question_id', q.id,
      'order_index', mq.order_index,
      'title', q.title,
      'prompt', q.prompt,
      'category', q.category,
      'topic', q.topic,
      'difficulty', q.difficulty,
      'options', q.options,
      'points', q.points
    ) ORDER BY mq.order_index ASC
  ) INTO v_questions_json
  FROM public.match_1v1_questions mq
  JOIN public.questions q ON q.id = mq.question_id
  WHERE mq.match_id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'questions', COALESCE(v_questions_json, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_1v1_match_questions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_1v1_match_questions(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 13. RPC: get_my_1v1_challenges
-- Returns incoming challenges, outgoing challenges, and active matches for caller
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_1v1_challenges(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_incoming JSONB;
  v_outgoing JSONB;
  v_active JSONB;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 50 THEN
    p_limit := 20;
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN
    p_offset := 0;
  END IF;

  -- Incoming pending challenges (caller is opponent)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'challenger_id', m.challenger_id,
      'category', m.category,
      'question_count', m.question_count,
      'time_per_question_seconds', m.time_per_question_seconds,
      'status', m.status,
      'created_at', m.created_at,
      'expires_at', m.expires_at,
      'challenger', jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'level', (public.calculate_level_progress(public.get_user_total_xp(p.id))->>'level')::int,
        'level_title', (public.calculate_level_progress(public.get_user_total_xp(p.id))->>'title')
      )
    ) ORDER BY m.created_at DESC
  ) INTO v_incoming
  FROM public.matches_1v1 m
  JOIN public.profiles p ON p.id = m.challenger_id
  WHERE m.opponent_id = v_caller_id
    AND m.status IN ('pending', 'waiting')
  LIMIT p_limit OFFSET p_offset;

  -- Outgoing pending challenges (caller is challenger)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'opponent_id', m.opponent_id,
      'category', m.category,
      'question_count', m.question_count,
      'time_per_question_seconds', m.time_per_question_seconds,
      'status', m.status,
      'created_at', m.created_at,
      'expires_at', m.expires_at,
      'opponent', jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'level', (public.calculate_level_progress(public.get_user_total_xp(p.id))->>'level')::int,
        'level_title', (public.calculate_level_progress(public.get_user_total_xp(p.id))->>'title')
      )
    ) ORDER BY m.created_at DESC
  ) INTO v_outgoing
  FROM public.matches_1v1 m
  JOIN public.profiles p ON p.id = m.opponent_id
  WHERE m.challenger_id = v_caller_id
    AND m.status IN ('pending', 'waiting')
  LIMIT p_limit OFFSET p_offset;

  -- Active matches (accepted or in_progress)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'challenger_id', m.challenger_id,
      'opponent_id', m.opponent_id,
      'category', m.category,
      'question_count', m.question_count,
      'time_per_question_seconds', m.time_per_question_seconds,
      'status', m.status,
      'started_at', m.started_at,
      'created_at', m.created_at,
      'is_caller_challenger', (m.challenger_id = v_caller_id),
      'competitor', jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'display_name', p.display_name,
        'avatar_url', p.avatar_url,
        'level', (public.calculate_level_progress(public.get_user_total_xp(p.id))->>'level')::int,
        'level_title', (public.calculate_level_progress(public.get_user_total_xp(p.id))->>'title')
      )
    ) ORDER BY m.updated_at DESC
  ) INTO v_active
  FROM public.matches_1v1 m
  JOIN public.profiles p ON p.id = CASE WHEN m.challenger_id = v_caller_id THEN m.opponent_id ELSE m.challenger_id END
  WHERE (m.challenger_id = v_caller_id OR m.opponent_id = v_caller_id)
    AND m.status IN ('accepted', 'in_progress')
  LIMIT 5;

  RETURN jsonb_build_object(
    'success', true,
    'incoming', COALESCE(v_incoming, '[]'::jsonb),
    'outgoing', COALESCE(v_outgoing, '[]'::jsonb),
    'active', COALESCE(v_active, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_1v1_challenges(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_1v1_challenges(INTEGER, INTEGER) TO authenticated, service_role;
