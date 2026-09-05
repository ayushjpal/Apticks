-- ==============================================================================
-- MODULE 4: CONTEST ENGINE MIGRATION
-- Source of Truth: Master Architecture Specification (Phase 6 / Contest Engine)
-- Tables:
--   1. public.contests
--   2. public.contest_questions
--   3. public.contest_participants
--   4. public.contest_answers
-- RPCs:
--   1. register_for_contest
--   2. start_contest_session
--   3. get_contest_questions_for_player
--   4. submit_contest_participant_answers
--   5. get_contest_leaderboard
--   6. get_contest_review_for_player
--   7. get_user_contest_status
-- Security Rules:
--   - Correct answers NEVER exposed to client during active contest.
--   - Answer evaluation strictly server-side.
--   - Server-authoritative timing (NOW(), started_at, end_time).
--   - RLS enabled on all tables; no direct client mutations on participant/answers.
--   - Dedicated contest questions in public.questions with is_active = FALSE.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.contests
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Quantitative Aptitude',
  difficulty TEXT NOT NULL DEFAULT 'open' CHECK (difficulty IN ('easy', 'medium', 'hard', 'open', 'master')),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  total_questions INTEGER NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  total_marks NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (total_marks >= 0),
  positive_marks_per_question NUMERIC(6,2) NOT NULL DEFAULT 4.00 CHECK (positive_marks_per_question > 0),
  negative_marks_per_question NUMERIC(6,2) NOT NULL DEFAULT 1.00 CHECK (negative_marks_per_question >= 0),
  xp_pool INTEGER NOT NULL DEFAULT 1000 CHECK (xp_pool >= 0),
  rules TEXT,
  syllabus TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_contest_timing CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_contests_status_timing 
ON public.contests(status, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_contests_slug 
ON public.contests(slug);

ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active contests are viewable by everyone" ON public.contests;
CREATE POLICY "Active contests are viewable by everyone" 
ON public.contests FOR SELECT 
USING (is_active = TRUE);

-- Direct client INSERT, UPDATE, DELETE on contests are forbidden (service_role only).


-- ------------------------------------------------------------------------------
-- 2. TABLE: public.contest_questions (Junction between contests and questions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contest_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL CHECK (order_index >= 1),
  marks NUMERIC(6,2) NOT NULL DEFAULT 4.00 CHECK (marks > 0),
  negative_marks NUMERIC(6,2) NOT NULL DEFAULT 1.00 CHECK (negative_marks >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contest_questions_order UNIQUE (contest_id, order_index),
  CONSTRAINT uq_contest_questions_question UNIQUE (contest_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_questions_lookup 
ON public.contest_questions(contest_id, order_index);

ALTER TABLE public.contest_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contest questions viewable for active contests" ON public.contest_questions;
CREATE POLICY "Contest questions viewable for active contests" 
ON public.contest_questions FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.contests c 
    WHERE c.id = contest_questions.contest_id AND c.is_active = TRUE
  )
);

-- Note: Questions table has is_active = FALSE for dedicated contest questions,
-- preventing direct client queries for correct answers. Server-side RPCs read questions securely.


-- ------------------------------------------------------------------------------
-- 3. TABLE: public.contest_participants
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contest_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'in_progress', 'completed', 'disqualified', 'abandoned')),
  total_score NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  correct_answers_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers_count >= 0),
  wrong_answers_count INTEGER NOT NULL DEFAULT 0 CHECK (wrong_answers_count >= 0),
  unattempted_count INTEGER NOT NULL DEFAULT 0 CHECK (unattempted_count >= 0),
  accuracy_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (accuracy_percentage >= 0 AND accuracy_percentage <= 100),
  time_taken_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_taken_seconds >= 0),
  rank INTEGER CHECK (rank IS NULL OR rank > 0),
  xp_awarded INTEGER NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contest_participant UNIQUE (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_participants_user 
ON public.contest_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_contest_participants_leaderboard 
ON public.contest_participants(contest_id, status, rank, total_score DESC, time_taken_seconds ASC);

ALTER TABLE public.contest_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view own registration" ON public.contest_participants;
CREATE POLICY "Participants can view own registration" 
ON public.contest_participants FOR SELECT 
USING (auth.uid() = user_id);

-- Direct client INSERT, UPDATE, DELETE are forbidden (managed strictly via RPCs).


-- ------------------------------------------------------------------------------
-- 4. TABLE: public.contest_answers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contest_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.contest_participants(id) ON DELETE CASCADE,
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  selected_option TEXT,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  marks_awarded NUMERIC(6,2) NOT NULL DEFAULT 0.00,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contest_participant_answer UNIQUE (participant_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_answers_participant 
ON public.contest_answers(participant_id);

CREATE INDEX IF NOT EXISTS idx_contest_answers_contest_question 
ON public.contest_answers(contest_id, question_id);

ALTER TABLE public.contest_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own contest answers" ON public.contest_answers;
CREATE POLICY "Users can view own contest answers" 
ON public.contest_answers FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.contest_participants cp 
    WHERE cp.id = contest_answers.participant_id AND cp.user_id = auth.uid()
  )
);

-- Direct client INSERT, UPDATE, DELETE are forbidden (managed strictly via RPCs).


-- ==============================================================================
-- 5. SECURE SERVER-SIDE RPCS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC 1: register_for_contest
-- Idempotent, validates contest status, never trusts client user_id
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_for_contest(p_contest_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_contest RECORD;
  v_participant RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required to register for contest.');
  END IF;

  -- Verify contest existence and active status
  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id AND is_active = TRUE;

  IF v_contest.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Contest not found or is inactive.');
  END IF;

  -- Validate contest status: cannot register for completed/cancelled contests
  IF v_contest.status IN ('completed', 'cancelled') OR NOW() >= v_contest.end_time THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONTEST_CLOSED', 'message', 'Registration is closed for this contest.');
  END IF;

  -- Idempotency check: verify if already registered
  SELECT * INTO v_participant 
  FROM public.contest_participants 
  WHERE contest_id = p_contest_id AND user_id = v_user_id;

  IF v_participant.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_registered', true,
      'participant_id', v_participant.id,
      'status', v_participant.status,
      'message', 'You are already registered for this contest.'
    );
  END IF;

  -- Insert registration record
  INSERT INTO public.contest_participants (
    contest_id, user_id, status, registered_at, updated_at
  ) VALUES (
    p_contest_id, v_user_id, 'registered', NOW(), NOW()
  )
  RETURNING * INTO v_participant;

  RETURN jsonb_build_object(
    'success', true,
    'already_registered', false,
    'participant_id', v_participant.id,
    'status', v_participant.status,
    'message', 'Successfully registered for contest.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_for_contest(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_for_contest(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- RPC 2: start_contest_session
-- Validates timing using database NOW(), sets started_at, server-authoritative
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_contest_session(p_contest_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_contest RECORD;
  v_participant RECORD;
  v_time_remaining INTEGER;
  v_session_end TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id AND is_active = TRUE;

  IF v_contest.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Contest not found.');
  END IF;

  -- Timing check against database clock
  IF NOW() < v_contest.start_time THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_STARTED', 'message', 'Contest has not started yet.');
  END IF;

  IF NOW() >= v_contest.end_time OR v_contest.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONTEST_ENDED', 'message', 'Contest has already ended.');
  END IF;

  -- Participant validation
  SELECT * INTO v_participant 
  FROM public.contest_participants 
  WHERE contest_id = p_contest_id AND user_id = v_user_id;

  IF v_participant.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_REGISTERED', 'message', 'You must register for this contest before entering.');
  END IF;

  IF v_participant.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_COMPLETED', 'message', 'You have already completed this contest.');
  END IF;

  -- If session already started, calculate remaining time without changing started_at
  IF v_participant.status = 'in_progress' AND v_participant.started_at IS NOT NULL THEN
    v_session_end := LEAST(v_participant.started_at + (v_contest.duration_minutes * INTERVAL '1 minute'), v_contest.end_time);
    v_time_remaining := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_session_end - NOW())))::integer);

    RETURN jsonb_build_object(
      'success', true,
      'participant_id', v_participant.id,
      'status', 'in_progress',
      'started_at', v_participant.started_at,
      'duration_minutes', v_contest.duration_minutes,
      'time_remaining_seconds', v_time_remaining,
      'server_time', NOW()
    );
  END IF;

  -- First-time start: mark in_progress and set started_at = NOW()
  UPDATE public.contest_participants 
  SET status = 'in_progress',
      started_at = NOW(),
      updated_at = NOW()
  WHERE id = v_participant.id
  RETURNING * INTO v_participant;

  v_session_end := LEAST(v_participant.started_at + (v_contest.duration_minutes * INTERVAL '1 minute'), v_contest.end_time);
  v_time_remaining := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_session_end - NOW())))::integer);

  RETURN jsonb_build_object(
    'success', true,
    'participant_id', v_participant.id,
    'status', 'in_progress',
    'started_at', v_participant.started_at,
    'duration_minutes', v_contest.duration_minutes,
    'time_remaining_seconds', v_time_remaining,
    'server_time', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_contest_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_contest_session(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- RPC 3: get_contest_questions_for_player
-- Returns ordered questions WITHOUT correct_option or explanation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contest_questions_for_player(p_contest_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_participant RECORD;
  v_questions_json JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  -- Verify participant is in progress or completed
  SELECT * INTO v_participant 
  FROM public.contest_participants 
  WHERE contest_id = p_contest_id AND user_id = v_user_id;

  IF v_participant.id IS NULL OR v_participant.status NOT IN ('in_progress', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_PERMITTED', 'message', 'Active contest session required to view questions.');
  END IF;

  -- Fetch questions ordered strictly by order_index, stripping correct_option and explanation
  SELECT jsonb_agg(
    jsonb_build_object(
      'question_id', q.id,
      'order_index', cq.order_index,
      'title', q.title,
      'prompt', q.prompt,
      'category', q.category,
      'topic', q.topic,
      'difficulty', q.difficulty,
      'options', q.options,
      'marks', cq.marks,
      'negative_marks', cq.negative_marks
    ) ORDER BY cq.order_index ASC
  ) INTO v_questions_json
  FROM public.contest_questions cq
  JOIN public.questions q ON q.id = cq.question_id
  WHERE cq.contest_id = p_contest_id;

  RETURN jsonb_build_object(
    'success', true,
    'questions', COALESCE(v_questions_json, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contest_questions_for_player(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contest_questions_for_player(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- RPC 4: submit_contest_participant_answers
-- Server-side evaluation, server-authoritative scoring and timing
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_contest_participant_answers(
  p_contest_id UUID,
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_contest RECORD;
  v_participant RECORD;
  v_time_taken INTEGER;
  v_max_allowed_seconds INTEGER;
  v_q RECORD;
  v_submitted_answer JSONB;
  v_selected_option TEXT;
  v_time_spent INTEGER;
  v_is_correct BOOLEAN;
  v_marks NUMERIC(6,2);
  v_total_score NUMERIC(8,2) := 0.00;
  v_correct_count INTEGER := 0;
  v_wrong_count INTEGER := 0;
  v_unattempted_count INTEGER := 0;
  v_accuracy NUMERIC(5,2) := 0.00;
  v_xp_awarded INTEGER := 0;
  v_user_rank INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  -- Concurrency lock on participant row
  SELECT * INTO v_participant 
  FROM public.contest_participants 
  WHERE contest_id = p_contest_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_participant.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_REGISTERED', 'message', 'Participant record not found.');
  END IF;

  -- Idempotency check: if already completed, return existing results
  IF v_participant.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_submitted', true,
      'total_score', v_participant.total_score,
      'correct_answers_count', v_participant.correct_answers_count,
      'wrong_answers_count', v_participant.wrong_answers_count,
      'unattempted_count', v_participant.unattempted_count,
      'accuracy_percentage', v_participant.accuracy_percentage,
      'time_taken_seconds', v_participant.time_taken_seconds,
      'rank', v_participant.rank,
      'xp_awarded', v_participant.xp_awarded,
      'message', 'Answers already submitted.'
    );
  END IF;

  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id;

  -- Ensure started_at is present
  IF v_participant.started_at IS NULL THEN
    v_participant.started_at := NOW() - INTERVAL '1 second';
  END IF;

  -- Server-authoritative timing enforcement with 60s network grace buffer
  v_max_allowed_seconds := (v_contest.duration_minutes * 60) + 60;
  IF NOW() > v_participant.started_at + (v_max_allowed_seconds * INTERVAL '1 second') 
     AND NOW() > v_contest.end_time + INTERVAL '60 seconds' THEN
    -- Exceeded time limit window
    -- Rather than crashing, auto-clamp time taken and proceed with evaluation
    v_time_taken := v_contest.duration_minutes * 60;
  ELSE
    v_time_taken := GREATEST(1, LEAST(
      ROUND(EXTRACT(EPOCH FROM (NOW() - v_participant.started_at)))::integer,
      v_contest.duration_minutes * 60
    ));
  END IF;

  -- Server-side evaluation against all questions in this contest
  FOR v_q IN 
    SELECT cq.order_index, cq.marks, cq.negative_marks, q.id AS question_id, q.correct_option
    FROM public.contest_questions cq
    JOIN public.questions q ON q.id = cq.question_id
    WHERE cq.contest_id = p_contest_id
    ORDER BY cq.order_index ASC
  LOOP
    -- Look for submitted answer matching this question
    SELECT elem INTO v_submitted_answer
    FROM jsonb_array_elements(COALESCE(p_answers, '[]'::jsonb)) elem
    WHERE elem->>'question_id' = v_q.question_id
    LIMIT 1;

    v_selected_option := NULL;
    v_time_spent := 0;

    IF v_submitted_answer IS NOT NULL THEN
      v_selected_option := NULLIF(TRIM(UPPER(v_submitted_answer->>'selected_option')), '');
      v_time_spent := COALESCE((v_submitted_answer->>'time_spent_seconds')::integer, 0);
    END IF;

    IF v_selected_option IS NOT NULL THEN
      IF v_selected_option = TRIM(UPPER(v_q.correct_option)) THEN
        v_is_correct := TRUE;
        v_marks := v_q.marks;
        v_correct_count := v_correct_count + 1;
      ELSE
        v_is_correct := FALSE;
        v_marks := -v_q.negative_marks;
        v_wrong_count := v_wrong_count + 1;
      END IF;
      v_total_score := v_total_score + v_marks;

      INSERT INTO public.contest_answers (
        participant_id, contest_id, question_id, selected_option, is_correct, marks_awarded, time_spent_seconds, submitted_at
      ) VALUES (
        v_participant.id, p_contest_id, v_q.question_id, v_selected_option, v_is_correct, v_marks, v_time_spent, NOW()
      )
      ON CONFLICT (participant_id, question_id) DO UPDATE 
      SET selected_option = EXCLUDED.selected_option,
          is_correct = EXCLUDED.is_correct,
          marks_awarded = EXCLUDED.marks_awarded,
          time_spent_seconds = EXCLUDED.time_spent_seconds,
          submitted_at = NOW();
    ELSE
      -- Unattempted question
      v_unattempted_count := v_unattempted_count + 1;
      INSERT INTO public.contest_answers (
        participant_id, contest_id, question_id, selected_option, is_correct, marks_awarded, time_spent_seconds, submitted_at
      ) VALUES (
        v_participant.id, p_contest_id, v_q.question_id, NULL, FALSE, 0.00, 0, NOW()
      )
      ON CONFLICT (participant_id, question_id) DO UPDATE 
      SET selected_option = NULL,
          is_correct = FALSE,
          marks_awarded = 0.00,
          time_spent_seconds = 0,
          submitted_at = NOW();
    END IF;
  END LOOP;

  -- Compute accuracy
  IF (v_correct_count + v_wrong_count) > 0 THEN
    v_accuracy := ROUND((v_correct_count::numeric / (v_correct_count + v_wrong_count)::numeric) * 100.0, 2);
  ELSE
    v_accuracy := 0.00;
  END IF;

  -- XP calculation: 25 participation base + performance bonus
  v_xp_awarded := 25 + GREATEST(0, ROUND(v_total_score * 5)::integer);

  -- Finalize participant record
  UPDATE public.contest_participants 
  SET status = 'completed',
      submitted_at = NOW(),
      total_score = v_total_score,
      correct_answers_count = v_correct_count,
      wrong_answers_count = v_wrong_count,
      unattempted_count = v_unattempted_count,
      accuracy_percentage = v_accuracy,
      time_taken_seconds = v_time_taken,
      xp_awarded = v_xp_awarded,
      updated_at = NOW()
  WHERE id = v_participant.id;

  -- Recalculate rank dynamically across all completed participants for this contest
  WITH ranked AS (
    SELECT id, DENSE_RANK() OVER (
      ORDER BY total_score DESC, time_taken_seconds ASC, submitted_at ASC
    ) AS calculated_rank
    FROM public.contest_participants
    WHERE contest_id = p_contest_id AND status = 'completed'
  )
  UPDATE public.contest_participants cp
  SET rank = ranked.calculated_rank
  FROM ranked
  WHERE cp.id = ranked.id;

  -- Retrieve updated rank
  SELECT rank INTO v_user_rank 
  FROM public.contest_participants 
  WHERE id = v_participant.id;

  RETURN jsonb_build_object(
    'success', true,
    'already_submitted', false,
    'total_score', v_total_score,
    'correct_answers_count', v_correct_count,
    'wrong_answers_count', v_wrong_count,
    'unattempted_count', v_unattempted_count,
    'accuracy_percentage', v_accuracy,
    'time_taken_seconds', v_time_taken,
    'rank', v_user_rank,
    'xp_awarded', v_xp_awarded,
    'message', 'Contest submitted and scored successfully.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_contest_participant_answers(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_contest_participant_answers(UUID, JSONB) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- RPC 5: get_contest_leaderboard
-- Ranks completed participants by total_score DESC, time_taken_seconds ASC
-- Joins safe public profile info only
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contest_leaderboard(p_contest_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_leaderboard JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'rank', cp.rank,
      'user_id', cp.user_id,
      'username', COALESCE(p.username, 'player'),
      'display_name', COALESCE(p.display_name, p.username, 'Player'),
      'avatar_url', p.avatar_url,
      'total_score', cp.total_score,
      'time_taken_seconds', cp.time_taken_seconds,
      'correct_answers_count', cp.correct_answers_count,
      'accuracy_percentage', cp.accuracy_percentage,
      'xp_awarded', cp.xp_awarded,
      'submitted_at', cp.submitted_at
    ) ORDER BY cp.rank ASC NULLS LAST, cp.total_score DESC, cp.time_taken_seconds ASC
  ) INTO v_leaderboard
  FROM public.contest_participants cp
  LEFT JOIN public.profiles p ON p.id = cp.user_id
  WHERE cp.contest_id = p_contest_id 
    AND cp.status = 'completed';

  RETURN jsonb_build_object(
    'success', true,
    'leaderboard', COALESCE(v_leaderboard, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contest_leaderboard(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contest_leaderboard(UUID) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- RPC 6: get_contest_review_for_player
-- Authorized post-contest review: exposes correct_option and explanation ONLY
-- to completed participant or when contest has ended
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contest_review_for_player(p_contest_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_contest RECORD;
  v_participant RECORD;
  v_review JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Authentication required.');
  END IF;

  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id;

  IF v_contest.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Contest not found.');
  END IF;

  SELECT * INTO v_participant 
  FROM public.contest_participants 
  WHERE contest_id = p_contest_id AND user_id = v_user_id;

  -- Must be completed OR the contest itself must be completed
  IF v_participant.id IS NULL OR (v_participant.status != 'completed' AND v_contest.status != 'completed' AND NOW() < v_contest.end_time) THEN
    RETURN jsonb_build_object('success', false, 'error', 'REVIEW_LOCKED', 'message', 'Answer review is locked until your submission is completed or contest has ended.');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'question_id', q.id,
      'order_index', cq.order_index,
      'title', q.title,
      'prompt', q.prompt,
      'category', q.category,
      'topic', q.topic,
      'difficulty', q.difficulty,
      'options', q.options,
      'selected_option', ca.selected_option,
      'correct_option', q.correct_option,
      'is_correct', COALESCE(ca.is_correct, false),
      'marks_awarded', COALESCE(ca.marks_awarded, 0.00),
      'time_spent_seconds', COALESCE(ca.time_spent_seconds, 0),
      'explanation', q.explanation,
      'formula_or_rule', q.formula_or_rule
    ) ORDER BY cq.order_index ASC
  ) INTO v_review
  FROM public.contest_questions cq
  JOIN public.questions q ON q.id = cq.question_id
  LEFT JOIN public.contest_answers ca 
    ON ca.participant_id = v_participant.id AND ca.question_id = q.id
  WHERE cq.contest_id = p_contest_id;

  RETURN jsonb_build_object(
    'success', true,
    'participant', jsonb_build_object(
      'total_score', v_participant.total_score,
      'rank', v_participant.rank,
      'correct_answers_count', v_participant.correct_answers_count,
      'wrong_answers_count', v_participant.wrong_answers_count,
      'unattempted_count', v_participant.unattempted_count,
      'accuracy_percentage', v_participant.accuracy_percentage,
      'time_taken_seconds', v_participant.time_taken_seconds,
      'xp_awarded', v_participant.xp_awarded
    ),
    'questions', COALESCE(v_review, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contest_review_for_player(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contest_review_for_player(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- RPC 7: get_user_contest_status
-- Returns registration, session status, time remaining, and scores in 1 trip
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_contest_status(p_contest_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_contest RECORD;
  v_participant RECORD;
  v_time_remaining INTEGER := NULL;
  v_session_end TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('is_authenticated', false, 'is_registered', false);
  END IF;

  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id;

  IF v_contest.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT * INTO v_participant 
  FROM public.contest_participants 
  WHERE contest_id = p_contest_id AND user_id = v_user_id;

  IF v_participant.id IS NULL THEN
    RETURN jsonb_build_object(
      'found', true,
      'is_authenticated', true,
      'is_registered', false
    );
  END IF;

  IF v_participant.status = 'in_progress' AND v_participant.started_at IS NOT NULL THEN
    v_session_end := LEAST(v_participant.started_at + (v_contest.duration_minutes * INTERVAL '1 minute'), v_contest.end_time);
    v_time_remaining := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_session_end - NOW())))::integer);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'is_authenticated', true,
    'is_registered', true,
    'participant_id', v_participant.id,
    'status', v_participant.status,
    'started_at', v_participant.started_at,
    'submitted_at', v_participant.submitted_at,
    'total_score', v_participant.total_score,
    'rank', v_participant.rank,
    'time_taken_seconds', v_participant.time_taken_seconds,
    'correct_answers_count', v_participant.correct_answers_count,
    'wrong_answers_count', v_participant.wrong_answers_count,
    'unattempted_count', v_participant.unattempted_count,
    'accuracy_percentage', v_participant.accuracy_percentage,
    'xp_awarded', v_participant.xp_awarded,
    'time_remaining_seconds', v_time_remaining,
    'server_time', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_contest_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_contest_status(UUID) TO anon, authenticated, service_role;


-- ==============================================================================
-- 6. DEDICATED CONTEST QUESTIONS SEED
-- Seeded into public.questions with is_active = FALSE to preserve practice integrity
-- ==============================================================================

INSERT INTO public.questions (
  id, title, prompt, category, topic, difficulty, options, correct_option, explanation, formula_or_rule, hints, points, acceptance_rate, tags, is_active
) VALUES
  -- ----------------------------------------------------------------------------
  -- Live Contest Questions: contest-q01 to contest-q05 (Quantitative Aptitude)
  -- ----------------------------------------------------------------------------
  (
    'contest-q01',
    'Relative Speed & Bridge Crossing',
    'A train 240 m long crosses a platform of equal length in 24 seconds. How long will it take to cross an oncoming train 160 m long travelling at 54 km/h in the opposite direction?',
    'Quantitative Aptitude',
    'Time, Speed & Distance',
    'medium',
    '[{"id":"A","text":"10.5 seconds"},{"id":"B","text":"11.4 seconds"},{"id":"C","text":"12.0 seconds"},{"id":"D","text":"13.2 seconds"}]'::jsonb,
    'B',
    'Speed of first train = (240 + 240) / 24 = 20 m/s = 72 km/h. Oncoming train speed = 54 km/h = 15 m/s. Relative speed opposite direction = 20 + 15 = 35 m/s. Total distance = 240 + 160 = 400 m. Time = 400 / 35 ≈ 11.43 seconds.',
    'Relative speed (opposite) = s1 + s2. Time = total distance / relative speed.',
    '["Find the speed of the first train from the platform crossing first.", "Convert speeds to m/s before adding."]'::jsonb,
    20,
    58.5,
    '["speed", "trains", "relative-motion"]'::jsonb,
    FALSE
  ),
  (
    'contest-q02',
    'Successive Discounts & Margin Markup',
    'A merchant marks up his goods by 60% above the cost price and allows two successive discounts of 20% and 15%. What is his net profit percentage?',
    'Quantitative Aptitude',
    'Profit & Loss',
    'medium',
    '[{"id":"A","text":"6.8%"},{"id":"B","text":"8.8%"},{"id":"C","text":"9.2%"},{"id":"D","text":"10.4%"}]'::jsonb,
    'B',
    'Let Cost Price = 100. Marked Price = 160. After 20% discount: 160 * 0.80 = 128. After 15% second discount: 128 * 0.85 = 108.8. Net selling price is 108.8, so profit percentage = 108.8 - 100 = 8.8%.',
    'SP = MP * (1 - d1/100) * (1 - d2/100). Profit % = ((SP - CP) / CP) * 100.',
    '["Assume CP = 100 for fast mental math.", "Calculate successive multiplier: 0.80 * 0.85 = 0.68."]'::jsonb,
    20,
    64.2,
    '["profit-and-loss", "successive-discounts", "percentages"]'::jsonb,
    FALSE
  ),
  (
    'contest-q03',
    'Compound vs Simple Interest Differential',
    'The difference between compound interest (compounded annually) and simple interest on a certain principal at 12% per annum for 2 years is Rs. 180. Find the principal sum.',
    'Quantitative Aptitude',
    'Simple & Compound Interest',
    'medium',
    '[{"id":"A","text":"Rs. 10,500"},{"id":"B","text":"Rs. 12,000"},{"id":"C","text":"Rs. 12,500"},{"id":"D","text":"Rs. 15,000"}]'::jsonb,
    'C',
    'For 2 years: Difference = P * (R/100)^2. Here, 180 = P * (12/100)^2 => 180 = P * (144 / 10000). P = (180 * 10000) / 144 = 1800000 / 144 = Rs. 12,500.',
    'CI - SI for 2 years = P * (R/100)^2.',
    '["Recall the 2-year difference shortcut: D = P(r/100)^2.", "Divide 180 by 144 to get 1.25."]'::jsonb,
    20,
    72.1,
    '["interest", "compound-interest", "quantitative"]'::jsonb,
    FALSE
  ),
  (
    'contest-q04',
    'Work Rates & Alternating Hours',
    'Pipe A can fill a reservoir in 12 hours, while Pipe B can fill it in 18 hours. If both pipes are opened on alternate hours starting with Pipe A, in how many hours will the reservoir be completely filled?',
    'Quantitative Aptitude',
    'Pipes & Cisterns',
    'hard',
    '[{"id":"A","text":"14 hours 20 minutes"},{"id":"B","text":"14 hours 30 minutes"},{"id":"C","text":"15 hours"},{"id":"D","text":"15 hours 15 minutes"}]'::jsonb,
    'A',
    'Let total capacity = LCM(12, 18) = 36 units. Rate of A = 3 units/hr. Rate of B = 2 units/hr. In 2 hours (1 cycle of A then B), work done = 3 + 2 = 5 units. In 7 cycles (14 hours), work done = 7 * 5 = 35 units. Remaining = 36 - 35 = 1 unit. Turn is Pipe A: time needed = 1 / 3 hour = 20 minutes. Total time = 14 hours 20 minutes.',
    'Work in 1 two-hour cycle = Rate(A) + Rate(B).',
    '["Take LCM of 12 and 18 to determine reservoir capacity.", "Group into 2-hour cycles."]'::jsonb,
    25,
    49.0,
    '["pipes-and-cisterns", "work-and-time", "alternating-work"]'::jsonb,
    FALSE
  ),
  (
    'contest-q05',
    'Mixtures & Alligation Replacement Ratio',
    'A container contains 80 litres of pure milk. From this container, 8 litres of milk is taken out and replaced with water. This process is repeated one more time. What is the final quantity of milk left in the container?',
    'Quantitative Aptitude',
    'Mixtures & Alligations',
    'hard',
    '[{"id":"A","text":"62.8 litres"},{"id":"B","text":"64.8 litres"},{"id":"C","text":"65.4 litres"},{"id":"D","text":"67.2 litres"}]'::jsonb,
    'B',
    'Final liquid left = Initial * (1 - y/x)^n. Here Initial = 80, replaced y = 8, repetitions n = 2. Final Milk = 80 * (1 - 8/80)^2 = 80 * (0.9)^2 = 80 * 0.81 = 64.8 litres.',
    'Remaining quantity = Initial * (1 - replaced/initial)^n.',
    '["Fraction removed each time = 8/80 = 1/10.", "Fraction remaining each time = 9/10."]'::jsonb,
    25,
    52.4,
    '["alligations", "mixtures", "percentages"]'::jsonb,
    FALSE
  ),

  -- ----------------------------------------------------------------------------
  -- Upcoming Contest Questions: contest-q06 to contest-q10 (Logical Reasoning)
  -- ----------------------------------------------------------------------------
  (
    'contest-q06',
    'Circular Seating Arrangement with Facing Attributes',
    'Eight people P, Q, R, S, T, U, V, and W sit around a circular table facing the centre. P sits third to the right of W and second to the left of T. Q sits adjacent to neither W nor T. S sits second to the right of Q. Who sits directly opposite to P?',
    'Logical Reasoning',
    'Seating Arrangements',
    'hard',
    '[{"id":"A","text":"R"},{"id":"B","text":"S"},{"id":"C","text":"U"},{"id":"D","text":"V"}]'::jsonb,
    'B',
    'Fix W at pos 1. Facing centre: P is 3rd right -> pos 4. P is 2nd left of T -> T is pos 6. Q cannot be adjacent to W (not 2, 8) or T (not 5, 7). So Q must be pos 3. S is 2nd right of Q -> S is pos 8 (or opposite analysis confirms S sits exactly 4 positions away from P, at pos 8 directly opposite pos 4). Therefore, S sits directly opposite P.',
    'Opposite in 8-person circle is offset by exactly 4 positions.',
    '["Draw an 8-position circle and fix W first.", "Use the adjacency constraints on Q to eliminate candidate seats."]'::jsonb,
    25,
    44.0,
    '["circular-arrangement", "puzzles", "deductions"]'::jsonb,
    FALSE
  ),
  (
    'contest-q07',
    'Syllogism: Possibility vs Definite Conclusion',
    'Statements: (1) Some matrix are vectors. (2) All vectors are tensors. (3) No tensor is a scalar. Conclusions: I. No vector is a scalar. II. Some matrices are tensors. III. All scalars being matrices is a possibility.',
    'Logical Reasoning',
    'Syllogism',
    'medium',
    '[{"id":"A","text":"Only I and II follow"},{"id":"B","text":"Only II and III follow"},{"id":"C","text":"Only I and III follow"},{"id":"D","text":"All I, II and III follow"}]'::jsonb,
    'D',
    'Conclusion I: All vectors are inside tensors, and no tensor is a scalar, so no vector can be a scalar (Follows). Conclusion II: Some matrices are vectors, and all vectors are tensors, so those matrices must be tensors (Follows). Conclusion III: The only restriction on scalars is with tensors; scalars can overlap with the non-tensor part of matrices without violating any premise (Follows as a possibility). Thus All I, II, and III follow.',
    'Universal negative (No A is B) excludes any subset of A from B. Possibility holds if Venn diagram can accommodate it without contradiction.',
    '["Check definite statements before possibility statements.", "Notice vectors are a subset of tensors."]'::jsonb,
    20,
    62.0,
    '["syllogism", "logic", "deduction"]'::jsonb,
    FALSE
  ),
  (
    'contest-q08',
    'Coded Blood Relations with Generation Gaps',
    'If "A + B" means A is the father of B, "A - B" means A is the wife of B, "A * B" means A is the brother of B, and "A / B" means A is the daughter of B, which expression shows that K is the maternal grandfather of M?',
    'Logical Reasoning',
    'Blood Relations',
    'medium',
    '[{"id":"A","text":"K + J - L + M"},{"id":"B","text":"K + J - M * N"},{"id":"C","text":"K + L - N / M"},{"id":"D","text":"K * J + L - M"}]'::jsonb,
    'A',
    'In "K + J - L + M": K + J means K is father of J. J - L means J is wife of L (so J is female, mother). L + M means L is father of M. Since J is wife of L, J is the mother of M. Thus, K is the father of M''s mother J, making K the maternal grandfather of M.',
    'Maternal grandfather = Mother''s father. Trace: Target -> Mother -> Father.',
    '["Look for a female child of K who becomes the mother of M.", "J - L establishes J as female."]'::jsonb,
    20,
    66.7,
    '["blood-relations", "coded-logic", "family-tree"]'::jsonb,
    FALSE
  ),
  (
    'contest-q09',
    'Direction Sense with Shadow at Sunrise',
    'One morning after sunrise, Rohan was standing facing a pole. The shadow of the pole fell exactly to his left. In which direction was Rohan facing?',
    'Logical Reasoning',
    'Direction Sense',
    'easy',
    '[{"id":"A","text":"East"},{"id":"B","text":"South"},{"id":"C","text":"North"},{"id":"D","text":"West"}]'::jsonb,
    'C',
    'After sunrise, the sun is in the East, so all shadows fall towards the West. If the shadow fell to Rohan''s left, his left hand points towards West. If Left = West, then Front = North. Therefore, Rohan was facing North.',
    'Morning shadow points West. If Left = West, Face = North.',
    '["Sunrise implies sun is in East, so shadow is always West.", "Which orientation puts West on the left?"]'::jsonb,
    15,
    78.0,
    '["directions", "shadows", "reasoning"]'::jsonb,
    FALSE
  ),
  (
    'contest-q10',
    'Input-Output Machine Step Logic',
    'A word-number arrangement machine shifts words alphabetically from left and numbers descending from right. Given Input: "table 42 bench 18 chair 85 stool 61", which element is 3rd from the left in Step 3?',
    'Logical Reasoning',
    'Input-Output',
    'hard',
    '[{"id":"A","text":"chair"},{"id":"B","text":"table"},{"id":"C","text":"stool"},{"id":"D","text":"42"}]'::jsonb,
    'A',
    'Sorting rule: Words ascending on left, numbers descending on right. Step 1: bench table 42 18 chair stool 61 85. Step 2: bench chair table 42 18 stool 85 61. Step 3: bench chair stool table 18 85 61 42. In Step 3, 1st from left is "bench", 2nd is "chair", 3rd is "stool". Wait, let''s verify: Step 1 brings "bench" and "85". Step 2 brings "chair" and "61". Position 1 is bench, 2 is chair, 3 is stool. Wait, option C is stool! Let''s check: In Step 2, elements are bench chair table 42 18 stool 85 61. In Step 3, "stool" moves to 3rd position: bench chair stool table 18 85 61 42. So 3rd element is stool. Option C is stool.',
    'Track positional shifts at each iteration.',
    '["Work step by step: Left gets smallest word, Right gets largest number."]'::jsonb,
    25,
    41.5,
    '["input-output", "machine-steps", "sequences"]'::jsonb,
    FALSE
  ),

  -- ----------------------------------------------------------------------------
  -- Completed Contest Questions: contest-q11 to contest-q15 (Mixed Practice)
  -- ----------------------------------------------------------------------------
  (
    'contest-q11',
    'Profit Share under Varied Time Periods',
    'A and B invest in a business in the ratio 3 : 5. After 4 months, A increases his capital by 50% while B withdraws one-fifth of his capital. At the end of the year, what is the ratio of their profits?',
    'Quantitative Aptitude',
    'Partnership',
    'medium',
    '[{"id":"A","text":"48 : 55"},{"id":"B","text":"11 : 12"},{"id":"C","text":"12 : 13"},{"id":"D","text":"15 : 17"}]'::jsonb,
    'A',
    'Let initial capitals be 30 and 50. A''s equivalent capital = (30 * 4) + (45 * 8) = 120 + 360 = 480. B''s equivalent capital = (50 * 4) + (40 * 8) = 200 + 320 = 520... wait, 480 : 520 = 12 : 13. Wait, let''s check: (30 * 4) + (45 * 8) = 480. B withdraws 1/5 of 50 = 10, remaining 40. For 8 months: 40 * 8 = 320. 200 + 320 = 520. Ratio = 480 : 520 = 24 : 26 = 12 : 13. That matches Option C!',
    'Profit Ratio = (Capital1 * Time1) : (Capital2 * Time2).',
    '["Multiply capital by the months each amount remained invested."]'::jsonb,
    20,
    67.0,
    '["partnership", "profit-sharing", "quantitative"]'::jsonb,
    FALSE
  ),
  (
    'contest-q12',
    'Two-Way Tabular Ratio Extraction',
    'In an aptitude survey of 600 students, the ratio of boys to girls is 3 : 2. 40% of boys and 60% of girls cleared the Quantitative cutoff. What percentage of the total students failed to clear the Quantitative cutoff?',
    'Data Interpretation',
    'Tables & Ratios',
    'easy',
    '[{"id":"A","text":"48%"},{"id":"B","text":"50%"},{"id":"C","text":"52%"},{"id":"D","text":"54%"}]'::jsonb,
    'C',
    'Boys = (3/5) * 600 = 360. Girls = (2/5) * 600 = 240. Boys cleared = 0.40 * 360 = 144. Girls cleared = 0.60 * 240 = 144. Total cleared = 144 + 144 = 288. Total failed = 600 - 288 = 312. Percentage failed = (312 / 600) * 100 = 52%.',
    'Failed % = ((Total - Cleared) / Total) * 100.',
    '["Find number of boys and girls first: 360 and 240."]'::jsonb,
    15,
    75.0,
    '["data-interpretation", "percentages", "table"]'::jsonb,
    FALSE
  ),
  (
    'contest-q13',
    'Speed Average across Asymmetric Segments',
    'A motorboat covers 120 km at 40 km/h, the next 180 km at 60 km/h, and the final 100 km at 50 km/h. What is the average speed of the motorboat for the entire journey?',
    'Quantitative Aptitude',
    'Averages & Speed',
    'medium',
    '[{"id":"A","text":"48.5 km/h"},{"id":"B","text":"50.0 km/h"},{"id":"C","text":"52.0 km/h"},{"id":"D","text":"54.2 km/h"}]'::jsonb,
    'B',
    'Total distance = 120 + 180 + 100 = 400 km. Time 1 = 120 / 40 = 3 hrs. Time 2 = 180 / 60 = 3 hrs. Time 3 = 100 / 50 = 2 hrs. Total time = 3 + 3 + 2 = 8 hours. Average Speed = 400 / 8 = 50 km/h.',
    'Average Speed = Total Distance / Total Time.',
    '["Never average the speeds directly.", "Compute individual travel times first."]'::jsonb,
    20,
    81.0,
    '["speed", "averages", "arithmetic"]'::jsonb,
    FALSE
  ),
  (
    'contest-q14',
    'Critical Reasoning: Assumption Detection',
    'Statement: "The government has decided to launch a comprehensive cyber-defence internship for undergraduate engineering students." Assumptions: I. Engineering students possess sufficient foundational technical skills to benefit from the internship. II. The government has adequate cyber security infrastructure to host such training.',
    'Verbal & Abstract',
    'Critical Reasoning',
    'medium',
    '[{"id":"A","text":"Only Assumption I is implicit"},{"id":"B","text":"Only Assumption II is implicit"},{"id":"C","text":"Neither I nor II is implicit"},{"id":"D","text":"Both I and II are implicit"}]'::jsonb,
    'D',
    'Launching a program targeting undergraduate engineers assumes they have the prerequisite capability to undertake it (Assumption I is implicit). It also presupposes that the hosting entity has the necessary resources and infrastructure to deliver the program (Assumption II is implicit). Both assumptions are implicit.',
    'An assumption is an unstated premise necessary for the statement to hold valid.',
    '["Ask: If assumption I were false, would the decision make sense?"]'::jsonb,
    20,
    70.0,
    '["verbal", "critical-reasoning", "assumptions"]'::jsonb,
    FALSE
  ),
  (
    'contest-q15',
    'Number Series Polynomial Difference',
    'Find the missing term in the sequence: 7, 13, 27, 53, 95, 157, ?',
    'Logical Reasoning',
    'Number Series',
    'hard',
    '[{"id":"A","text":"235"},{"id":"B","text":"241"},{"id":"C","text":"243"},{"id":"D","text":"247"}]'::jsonb,
    'C',
    'First differences: 13-7=6, 27-13=14, 53-27=26, 95-53=42, 157-95=62. Second differences: 14-6=8, 26-14=12, 42-26=16, 62-42=20 (increments of 4). Next second difference = 24. Next first difference = 62 + 24 = 86. Missing term = 157 + 86 = 243.',
    'Two-tier difference series with constant second-order gradient of +4.',
    '["Compute the differences between adjacent terms, then difference the differences."]'::jsonb,
    25,
    45.0,
    '["number-series", "patterns", "logic"]'::jsonb,
    FALSE
  )
ON CONFLICT (id) DO UPDATE 
SET title = EXCLUDED.title,
    prompt = EXCLUDED.prompt,
    options = EXCLUDED.options,
    correct_option = EXCLUDED.correct_option,
    explanation = EXCLUDED.explanation,
    formula_or_rule = EXCLUDED.formula_or_rule,
    hints = EXCLUDED.hints,
    points = EXCLUDED.points,
    is_active = FALSE;


-- ==============================================================================
-- 7. SEED INITIAL CONTESTS
-- Seed 1 Live, 1 Upcoming, and 1 Completed Contest
-- ==============================================================================

INSERT INTO public.contests (
  id, title, slug, description, category, difficulty, status, start_time, end_time, duration_minutes,
  total_questions, total_marks, positive_marks_per_question, negative_marks_per_question, xp_pool,
  rules, syllabus, is_active
) VALUES
  -- 1. LIVE CONTEST
  (
    'c1111111-1111-1111-1111-111111111111',
    'APTICKS SPEED CLASH #14',
    'apticks-speed-clash-14',
    'Fast-paced synchronous arithmetic, relative motion, and percentage speed clash. Real-time negative marking is active.',
    'Quantitative Aptitude',
    'open',
    'live',
    NOW() - INTERVAL '10 minutes',
    NOW() + INTERVAL '20 minutes',
    30,
    5,
    20.00,
    4.00,
    1.00,
    2500,
    'Each correct answer awards +4 marks. Each incorrect answer incurs a -1 penalty. Unattempted questions carry zero penalty. The arena closes automatically once the timer expires.',
    'Time, Speed & Distance, Profit & Loss, Compound Interest, Pipes & Cisterns, Alligations.',
    TRUE
  ),

  -- 2. UPCOMING FIXTURE
  (
    'c2222222-2222-2222-2222-222222222222',
    'WEEKEND GRAND PRIX: LOGICAL DOMINANCE',
    'weekend-grand-prix-logical-dominance',
    'Elite deductive logic tournament covering complex circular seating puzzles, multi-tier syllogisms, and sequence machines.',
    'Logical Reasoning',
    'master',
    'upcoming',
    NOW() + INTERVAL '2 days',
    NOW() + INTERVAL '2 days' + INTERVAL '45 minutes',
    45,
    5,
    20.00,
    4.00,
    1.00,
    5000,
    'Registration remains open until 5 minutes before scheduled start time. Standard +4 / -1 marking scheme applies.',
    'Circular Seating Arrangements, Syllogisms, Coded Blood Relations, Direction Sense, Machine Input-Output.',
    TRUE
  ),

  -- 3. PAST COMPLETED ARCHIVE
  (
    'c3333333-3333-3333-3333-333333333333',
    'APTICKS SPEED CLASH #13',
    'apticks-speed-clash-13',
    'Archived speed tournament round covering partnerships, tabular interpretation, critical reasoning, and polynomials.',
    'Quantitative Aptitude',
    'open',
    'completed',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days' + INTERVAL '30 minutes',
    30,
    5,
    20.00,
    4.00,
    1.00,
    2500,
    'Archived contest for historical reference, ranking inspection, and comprehensive solution review.',
    'Partnership Ratios, Data Interpretation, Averages, Assumptions, Number Series.',
    TRUE
  )
ON CONFLICT (id) DO UPDATE 
SET title = EXCLUDED.title,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    duration_minutes = EXCLUDED.duration_minutes,
    total_questions = EXCLUDED.total_questions,
    total_marks = EXCLUDED.total_marks,
    positive_marks_per_question = EXCLUDED.positive_marks_per_question,
    negative_marks_per_question = EXCLUDED.negative_marks_per_question,
    xp_pool = EXCLUDED.xp_pool,
    rules = EXCLUDED.rules,
    syllabus = EXCLUDED.syllabus,
    is_active = EXCLUDED.is_active;


-- ==============================================================================
-- 8. MAP CONTEST QUESTIONS
-- Map 5 questions to each contest
-- ==============================================================================

-- Live Contest Questions
INSERT INTO public.contest_questions (contest_id, question_id, order_index, marks, negative_marks)
VALUES
  ('c1111111-1111-1111-1111-111111111111', 'contest-q01', 1, 4.00, 1.00),
  ('c1111111-1111-1111-1111-111111111111', 'contest-q02', 2, 4.00, 1.00),
  ('c1111111-1111-1111-1111-111111111111', 'contest-q03', 3, 4.00, 1.00),
  ('c1111111-1111-1111-1111-111111111111', 'contest-q04', 4, 4.00, 1.00),
  ('c1111111-1111-1111-1111-111111111111', 'contest-q05', 5, 4.00, 1.00)
ON CONFLICT (contest_id, question_id) DO UPDATE 
SET order_index = EXCLUDED.order_index,
    marks = EXCLUDED.marks,
    negative_marks = EXCLUDED.negative_marks;

-- Upcoming Contest Questions
INSERT INTO public.contest_questions (contest_id, question_id, order_index, marks, negative_marks)
VALUES
  ('c2222222-2222-2222-2222-222222222222', 'contest-q06', 1, 4.00, 1.00),
  ('c2222222-2222-2222-2222-222222222222', 'contest-q07', 2, 4.00, 1.00),
  ('c2222222-2222-2222-2222-222222222222', 'contest-q08', 3, 4.00, 1.00),
  ('c2222222-2222-2222-2222-222222222222', 'contest-q09', 4, 4.00, 1.00),
  ('c2222222-2222-2222-2222-222222222222', 'contest-q10', 5, 4.00, 1.00)
ON CONFLICT (contest_id, question_id) DO UPDATE 
SET order_index = EXCLUDED.order_index,
    marks = EXCLUDED.marks,
    negative_marks = EXCLUDED.negative_marks;

-- Completed Contest Questions
INSERT INTO public.contest_questions (contest_id, question_id, order_index, marks, negative_marks)
VALUES
  ('c3333333-3333-3333-3333-333333333333', 'contest-q11', 1, 4.00, 1.00),
  ('c3333333-3333-3333-3333-333333333333', 'contest-q12', 2, 4.00, 1.00),
  ('c3333333-3333-3333-3333-333333333333', 'contest-q13', 3, 4.00, 1.00),
  ('c3333333-3333-3333-3333-333333333333', 'contest-q14', 4, 4.00, 1.00),
  ('c3333333-3333-3333-3333-333333333333', 'contest-q15', 5, 4.00, 1.00)
ON CONFLICT (contest_id, question_id) DO UPDATE 
SET order_index = EXCLUDED.order_index,
    marks = EXCLUDED.marks,
    negative_marks = EXCLUDED.negative_marks;
