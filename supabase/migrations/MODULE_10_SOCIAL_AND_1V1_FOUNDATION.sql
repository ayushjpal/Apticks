-- ==============================================================================
-- MODULE 10 — SOCIAL + 1v1: DATABASE FOUNDATION & RLS IMPLEMENTATION
-- Migration: MODULE_10_SOCIAL_AND_1V1_FOUNDATION.sql
-- ==============================================================================
-- Scope (Ordered by Dependency):
--   0. Reusable Timestamp Trigger: public.set_updated_at_timestamp()
--   1. Table: public.user_blocks (Social isolation boundary - defined first for policy dependencies)
--   2. Table: public.user_follows (Asymmetric social graph)
--   3. Table: public.friendships (Symmetric mutual friendship requests)
--   4. Table: public.notifications (In-app notification ledger)
--   5. Table: public.matches_1v1 (1v1 competitive battle ledger)
--   6. Table: public.match_1v1_questions (Match question assignments)
--   7. Table: public.match_1v1_answers (Participant answers & evaluation)
--   8. Realtime Publication: notifications & matches_1v1
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. REUSABLE TRIGGER FUNCTION: set_updated_at_timestamp
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------------------------
-- 1. TABLE: public.user_blocks
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own block list" ON public.user_blocks;
CREATE POLICY "Users can view their own block list"
  ON public.user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can block other users" ON public.user_blocks;
CREATE POLICY "Users can block other users"
  ON public.user_blocks FOR INSERT
  WITH CHECK (
    auth.uid() = blocker_id
    AND blocker_id <> blocked_id
  );

DROP POLICY IF EXISTS "Users can unblock users" ON public.user_blocks;
CREATE POLICY "Users can unblock users"
  ON public.user_blocks FOR DELETE
  USING (auth.uid() = blocker_id);


-- ------------------------------------------------------------------------------
-- 2. TABLE: public.user_follows
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Users can create their own outgoing follows" ON public.user_follows;
CREATE POLICY "Users can create their own outgoing follows"
  ON public.user_follows FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
    AND follower_id <> following_id
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = follower_id AND b.blocked_id = following_id)
         OR (b.blocker_id = following_id AND b.blocked_id = follower_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete their own outgoing follows" ON public.user_follows;
CREATE POLICY "Users can delete their own outgoing follows"
  ON public.user_follows FOR DELETE
  USING (auth.uid() = follower_id);


-- ------------------------------------------------------------------------------
-- 3. TABLE: public.friendships
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_no_self_friendship CHECK (sender_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_unique_pair 
ON public.friendships (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id));

CREATE INDEX IF NOT EXISTS idx_friendships_receiver_status ON public.friendships(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_sender_status ON public.friendships(sender_id, status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friendships" ON public.friendships;
CREATE POLICY "Users can view their own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON public.friendships;
CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_id <> receiver_id
    AND status = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = sender_id AND b.blocked_id = receiver_id)
         OR (b.blocker_id = receiver_id AND b.blocked_id = sender_id)
    )
  );

DROP POLICY IF EXISTS "Receivers can update friendship status" ON public.friendships;
CREATE POLICY "Receivers can update friendship status"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can delete their own friendships" ON public.friendships;
CREATE POLICY "Users can delete their own friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP TRIGGER IF EXISTS trg_friendships_updated_at ON public.friendships;
CREATE TRIGGER trg_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();


-- ------------------------------------------------------------------------------
-- 4. TABLE: public.notifications
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'friend_request',
    'friend_accepted',
    'challenge_received',
    'challenge_accepted',
    'challenge_declined',
    'match_ready',
    'match_completed',
    'new_follower',
    'system_alert'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notification read state" ON public.notifications;
CREATE POLICY "Users can update their own notification read state"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Note on notifications INSERT:
-- Direct client INSERT is intentionally restricted. Notifications are created exclusively
-- via server-side SECURITY DEFINER RPCs and triggers in subsequent phases.


-- ------------------------------------------------------------------------------
-- 5. TABLE: public.matches_1v1
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matches_1v1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'All Topics',
  question_count INTEGER NOT NULL DEFAULT 5 CHECK (question_count IN (3, 5, 10)),
  time_per_question_seconds INTEGER NOT NULL DEFAULT 60 CHECK (time_per_question_seconds BETWEEN 30 AND 120),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'accepted',
    'in_progress',
    'completed',
    'declined',
    'cancelled',
    'abandoned'
  )),
  challenger_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  opponent_score NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  challenger_time_taken INTEGER NOT NULL DEFAULT 0,
  opponent_time_taken INTEGER NOT NULL DEFAULT 0,
  winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_draw BOOLEAN NOT NULL DEFAULT FALSE,
  challenger_xp_awarded INTEGER NOT NULL DEFAULT 0,
  opponent_xp_awarded INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_no_self_match CHECK (challenger_id <> opponent_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_1v1_challenger ON public.matches_1v1(challenger_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_1v1_opponent ON public.matches_1v1(opponent_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_1v1_created_at ON public.matches_1v1(created_at DESC);

ALTER TABLE public.matches_1v1 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their own 1v1 matches" ON public.matches_1v1;
CREATE POLICY "Participants can view their own 1v1 matches"
  ON public.matches_1v1 FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Note on matches_1v1 mutations:
-- Direct client INSERT, UPDATE, and DELETE are intentionally omitted.
-- All match lifecycle transitions (create, accept, decline, cancel, submit, finalize)
-- are executed exclusively through server-authoritative SECURITY DEFINER RPCs.

DROP TRIGGER IF EXISTS trg_matches_1v1_updated_at ON public.matches_1v1;
CREATE TRIGGER trg_matches_1v1_updated_at
  BEFORE UPDATE ON public.matches_1v1
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();


-- ------------------------------------------------------------------------------
-- 6. TABLE: public.match_1v1_questions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_1v1_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches_1v1(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL CHECK (order_index >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_match_questions_order UNIQUE (match_id, order_index),
  CONSTRAINT uq_match_questions_q UNIQUE (match_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_match_1v1_questions_lookup ON public.match_1v1_questions(match_id, order_index);

ALTER TABLE public.match_1v1_questions ENABLE ROW LEVEL SECURITY;

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

-- Direct client mutations forbidden (managed exclusively via match RPCs).


-- ------------------------------------------------------------------------------
-- 7. TABLE: public.match_1v1_answers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_1v1_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches_1v1(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  selected_option TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  score_awarded NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_match_user_answer UNIQUE (match_id, user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_match_1v1_answers_match_user ON public.match_1v1_answers(match_id, user_id);

ALTER TABLE public.match_1v1_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view match answers" ON public.match_1v1_answers;
CREATE POLICY "Participants can view match answers"
  ON public.match_1v1_answers FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.matches_1v1 m
      WHERE m.id = match_1v1_answers.match_id
        AND (m.challenger_id = auth.uid() OR m.opponent_id = auth.uid())
        AND m.status = 'completed'
    )
  );

-- Direct client mutations forbidden (managed exclusively via submit_1v1_answer RPC).


-- ------------------------------------------------------------------------------
-- 8. REALTIME REPLICATION CONFIGURATION
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- Add public.notifications to supabase_realtime if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;

  -- Add public.matches_1v1 to supabase_realtime if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'matches_1v1'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches_1v1;
  END IF;
END $$;
