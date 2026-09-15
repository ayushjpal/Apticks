-- ==============================================================================
-- MODULE 3: DAILY STREAKS + DAILY CHALLENGES
-- Tables: public.user_streaks, public.daily_challenges, public.user_daily_challenge_completions
-- RPCs: get_daily_challenge, submit_daily_challenge, record_streak_activity, get_user_streak
-- ==============================================================================

-- 1. Create table for user streak state (isolated from profiles to prevent client tampering)
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  longest_streak INTEGER NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
  last_active_date DATE DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_last_active 
ON public.user_streaks(user_id, last_active_date);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own streak" ON public.user_streaks;
CREATE POLICY "Users can view own streak" 
ON public.user_streaks FOR SELECT 
USING (auth.uid() = user_id);

-- Note: Direct client INSERT, UPDATE, DELETE are forbidden on user_streaks.
-- Streak mutations are managed strictly through trusted SECURITY DEFINER RPC functions.


-- 2. Create table for daily challenge schedule
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date DATE NOT NULL UNIQUE,
  question_id TEXT REFERENCES public.questions(id) ON DELETE RESTRICT NOT NULL,
  bonus_xp INTEGER NOT NULL DEFAULT 50 CHECK (bonus_xp >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_challenges_date 
ON public.daily_challenges(challenge_date);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Daily challenges are viewable by everyone" ON public.daily_challenges;
CREATE POLICY "Daily challenges are viewable by everyone" 
ON public.daily_challenges FOR SELECT 
USING (is_active = TRUE AND challenge_date <= CURRENT_DATE + INTERVAL '1 day');

-- Note: Direct client INSERT, UPDATE, DELETE are forbidden (service_role only).


-- 3. Create table for user daily challenge completion records
CREATE TABLE IF NOT EXISTS public.user_daily_challenge_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenge_id UUID REFERENCES public.daily_challenges(id) ON DELETE CASCADE NOT NULL,
  challenge_date DATE NOT NULL,
  bonus_xp_awarded INTEGER NOT NULL DEFAULT 0 CHECK (bonus_xp_awarded >= 0),
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_daily_challenge UNIQUE (user_id, challenge_id),
  CONSTRAINT uq_user_challenge_date UNIQUE (user_id, challenge_date)
);

CREATE INDEX IF NOT EXISTS idx_user_challenge_completions_user 
ON public.user_daily_challenge_completions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_challenge_completions_user_date 
ON public.user_daily_challenge_completions(user_id, challenge_date);

ALTER TABLE public.user_daily_challenge_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own challenge completions" ON public.user_daily_challenge_completions;
CREATE POLICY "Users can view own challenge completions" 
ON public.user_daily_challenge_completions FOR SELECT 
USING (auth.uid() = user_id);

-- Note: Direct client INSERT, UPDATE, DELETE are forbidden (managed by RPC only).


-- ==============================================================================
-- 4. SEED INITIAL 30-DAY DETERMINISTIC SCHEDULE (2026-09-01 TO 2026-09-30)
-- Balanced across Quant (8), Logic (8), DI (7), Verbal (7)
-- ==============================================================================

INSERT INTO public.daily_challenges (challenge_date, question_id, bonus_xp, is_active)
VALUES
  ('2026-09-01', 'quant-001', 50, true),
  ('2026-09-02', 'lr-001', 50, true),
  ('2026-09-03', 'di-001', 50, true),
  ('2026-09-04', 'verbal-001', 50, true),
  ('2026-09-05', 'quant-002', 50, true),
  ('2026-09-06', 'lr-002', 50, true),
  ('2026-09-07', 'di-002', 50, true),
  ('2026-09-08', 'verbal-002', 50, true),
  ('2026-09-09', 'quant-003', 50, true),
  ('2026-09-10', 'lr-003', 50, true),
  ('2026-09-11', 'di-003', 50, true),
  ('2026-09-12', 'verbal-003', 50, true),
  ('2026-09-13', 'quant-004', 50, true),
  ('2026-09-14', 'lr-004', 50, true),
  ('2026-09-15', 'di-004', 50, true),
  ('2026-09-16', 'verbal-004', 50, true),
  ('2026-09-17', 'quant-005', 50, true),
  ('2026-09-18', 'lr-005', 50, true),
  ('2026-09-19', 'di-005', 50, true),
  ('2026-09-20', 'verbal-005', 50, true),
  ('2026-09-21', 'quant-006', 50, true),
  ('2026-09-22', 'lr-006', 50, true),
  ('2026-09-23', 'di-006', 50, true),
  ('2026-09-24', 'verbal-006', 50, true),
  ('2026-09-25', 'quant-007', 50, true),
  ('2026-09-26', 'lr-007', 50, true),
  ('2026-09-27', 'di-007', 50, true),
  ('2026-09-28', 'verbal-007', 50, true),
  ('2026-09-29', 'quant-008', 50, true),
  ('2026-09-30', 'lr-008', 50, true)
ON CONFLICT (challenge_date) DO UPDATE
SET question_id = EXCLUDED.question_id,
    bonus_xp = EXCLUDED.bonus_xp,
    is_active = EXCLUDED.is_active;


-- ==============================================================================
-- 5. SECURE RPC: get_daily_challenge
-- Returns challenge metadata and question details WITHOUT exposing correct_option
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_daily_challenge(p_timezone TEXT DEFAULT 'UTC')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tz TEXT;
  v_today DATE;
  v_challenge RECORD;
  v_question RECORD;
  v_is_completed BOOLEAN := FALSE;
  v_bonus_awarded INTEGER := 0;
  v_completed_at TIMESTAMPTZ := NULL;
  v_seconds_until_midnight INTEGER;
BEGIN
  v_user_id := auth.uid();

  -- 1. Validate timezone against pg_timezone_names, fallback to UTC
  IF p_timezone IS NOT NULL AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    v_tz := p_timezone;
  ELSE
    v_tz := 'UTC';
  END IF;

  -- 2. Determine authoritative calendar date in user's timezone
  v_today := (NOW() AT TIME ZONE v_tz)::date;

  -- Calculate seconds left until midnight in user's timezone
  v_seconds_until_midnight := GREATEST(0, EXTRACT(EPOCH FROM ((v_today + 1)::timestamp AT TIME ZONE v_tz - NOW()))::integer);

  -- 3. Fetch challenge definition for today
  SELECT * INTO v_challenge
  FROM public.daily_challenges
  WHERE challenge_date = v_today AND is_active = TRUE;

  -- Dynamic fallback if specific date not seeded yet:
  -- Pick deterministically based on date offset from active questions
  IF v_challenge.id IS NULL THEN
    SELECT * INTO v_challenge
    FROM public.daily_challenges
    WHERE is_active = TRUE
    ORDER BY challenge_date DESC
    LIMIT 1;
  END IF;

  IF v_challenge.id IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'message', 'No active daily challenge found for today.'
    );
  END IF;

  -- 4. Fetch question details (EXCLUDING correct_option and explanation)
  SELECT 
    id, title, prompt, category, topic, difficulty, options, points, tags
  INTO v_question
  FROM public.questions
  WHERE id = v_challenge.question_id;

  IF v_question.id IS NULL THEN
    RETURN jsonb_build_object(
      'found', false,
      'message', 'Challenge question not found in database.'
    );
  END IF;

  -- 5. Check if authenticated user has completed this challenge
  IF v_user_id IS NOT NULL THEN
    SELECT 
      TRUE, bonus_xp_awarded, completed_at
    INTO 
      v_is_completed, v_bonus_awarded, v_completed_at
    FROM public.user_daily_challenge_completions
    WHERE user_id = v_user_id AND challenge_id = v_challenge.id;

    IF v_is_completed IS NULL THEN
      v_is_completed := FALSE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'challenge_id', v_challenge.id,
    'challenge_date', v_challenge.challenge_date,
    'bonus_xp', v_challenge.bonus_xp,
    'is_completed', v_is_completed,
    'bonus_xp_awarded', v_bonus_awarded,
    'completed_at', v_completed_at,
    'seconds_left', v_seconds_until_midnight,
    'question', jsonb_build_object(
      'id', v_question.id,
      'title', v_question.title,
      'prompt', v_question.prompt,
      'category', v_question.category,
      'topic', v_question.topic,
      'difficulty', v_question.difficulty,
      'options', v_question.options,
      'points', v_question.points,
      'tags', v_question.tags
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_challenge(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_challenge(TEXT) TO anon, authenticated, service_role;


-- ==============================================================================
-- 6. SECURE RPC: submit_daily_challenge
-- Transactional, row-locked, tamper-proof submission and reward engine
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.submit_daily_challenge(
  p_challenge_id UUID,
  p_selected_option TEXT,
  p_time_spent_seconds INTEGER,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tz TEXT;
  v_today DATE;
  v_challenge RECORD;
  v_question RECORD;
  v_streak RECORD;
  v_completion RECORD;
  v_is_correct BOOLEAN;
  v_clean_selected TEXT;
  v_clean_correct TEXT;
  v_new_streak INTEGER;
  v_longest_streak INTEGER;
  v_penalty INTEGER;
  v_was_already_solved BOOLEAN := FALSE;
  v_existing_prog RECORD;
  v_attempt_number INTEGER := 1;
  v_new_completion_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: User session required to submit challenge.';
  END IF;

  IF p_selected_option IS NULL OR trim(p_selected_option) = '' THEN
    RAISE EXCEPTION 'Option selection is required.';
  END IF;

  -- 1. Validate timezone
  IF p_timezone IS NOT NULL AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    v_tz := p_timezone;
  ELSE
    v_tz := 'UTC';
  END IF;

  v_today := (NOW() AT TIME ZONE v_tz)::date;

  -- 2. Fetch challenge definition
  SELECT * INTO v_challenge
  FROM public.daily_challenges
  WHERE id = p_challenge_id AND is_active = TRUE;

  IF v_challenge.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge not found or inactive.');
  END IF;

  -- 3. Fetch authoritative question details including correct_option
  SELECT * INTO v_question
  FROM public.questions
  WHERE id = v_challenge.question_id;

  IF v_question.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Question not found.');
  END IF;

  v_clean_selected := trim(upper(p_selected_option));
  v_clean_correct := trim(upper(v_question.correct_option));
  v_is_correct := (v_clean_selected = v_clean_correct);

  -- ============================================================================
  -- 4. IMMEDIATE AUTHORITATIVE COMPLETION GUARD
  -- If the user has ALREADY completed this challenge (or completed today's challenge),
  -- immediately return an idempotent response with ZERO bonus XP and ZERO question XP.
  -- DO NOT apply penalties, DO NOT modify streaks, DO NOT create completion records.
  -- ============================================================================
  SELECT * INTO v_completion
  FROM public.user_daily_challenge_completions
  WHERE user_id = v_user_id
    AND (challenge_id = v_challenge.id OR challenge_date = v_challenge.challenge_date);

  IF v_completion.id IS NOT NULL THEN
    -- Fetch current streak safely for display
    SELECT current_streak, longest_streak INTO v_streak
    FROM public.user_streaks
    WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'is_correct', true,
      'correct_option', v_clean_correct,
      'explanation', v_question.explanation,
      'bonus_xp', 0,
      'question_xp', 0,
      'already_completed', true,
      'streak', COALESCE(v_streak.current_streak, 1),
      'longest_streak', COALESCE(v_streak.longest_streak, 1),
      'message', 'Daily challenge already completed. Bonus already claimed for today.'
    );
  END IF;

  -- 5. Check existing question progress to preserve unified attempt metrics
  SELECT * INTO v_existing_prog
  FROM public.user_question_progress
  WHERE user_id = v_user_id AND question_id = v_question.id;

  IF v_existing_prog.id IS NOT NULL THEN
    v_was_already_solved := v_existing_prog.is_solved;
    v_attempt_number := v_existing_prog.attempts_count + 1;
  END IF;

  -- 6. If INCORRECT: Record attempt with standard -25% penalty, DO NOT complete challenge
  IF NOT v_is_correct THEN
    v_penalty := GREATEST(1, round(v_question.points * 0.25)::integer);

    -- Log attempt
    INSERT INTO public.user_question_attempts (
      user_id, question_id, selected_option, is_correct, xp_change, attempt_number, time_spent_seconds, created_at
    ) VALUES (
      v_user_id, v_question.id, v_clean_selected, false, -v_penalty, v_attempt_number, COALESCE(p_time_spent_seconds, 0), NOW()
    );

    -- Update question progress
    INSERT INTO public.user_question_progress (
      user_id, question_id, selected_option, is_solved, is_correct, attempts_count, time_spent_seconds, last_attempted_at
    ) VALUES (
      v_user_id, v_question.id, v_clean_selected, v_was_already_solved, false, v_attempt_number, COALESCE(p_time_spent_seconds, 0), NOW()
    )
    ON CONFLICT (user_id, question_id) DO UPDATE
    SET attempts_count = user_question_progress.attempts_count + 1,
        time_spent_seconds = user_question_progress.time_spent_seconds + EXCLUDED.time_spent_seconds,
        selected_option = EXCLUDED.selected_option,
        last_attempted_at = NOW();

    RETURN jsonb_build_object(
      'success', true,
      'is_correct', false,
      'correct_option', v_clean_correct,
      'explanation', v_question.explanation,
      'bonus_xp', 0,
      'question_xp', 0,
      'xp_change', -v_penalty,
      'already_completed', false,
      'message', 'Incorrect answer. Try again to complete the challenge.'
    );
  END IF;

  -- ============================================================================
  -- 7. User answered CORRECTLY: Concurrency lock on user_streaks row
  -- ============================================================================
  INSERT INTO public.user_streaks (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak
  FROM public.user_streaks
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- Secondary concurrency check within locked transaction
  SELECT * INTO v_completion
  FROM public.user_daily_challenge_completions
  WHERE user_id = v_user_id
    AND (challenge_id = v_challenge.id OR challenge_date = v_challenge.challenge_date);

  IF v_completion.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_correct', true,
      'correct_option', v_clean_correct,
      'explanation', v_question.explanation,
      'bonus_xp', 0,
      'question_xp', 0,
      'already_completed', true,
      'streak', v_streak.current_streak,
      'longest_streak', v_streak.longest_streak,
      'message', 'Daily challenge already completed. Bonus already claimed for today.'
    );
  END IF;

  -- ============================================================================
  -- 8. First completion today: Record in user_daily_challenge_completions
  -- Anchored strictly to v_challenge.challenge_date with ON CONFLICT DO NOTHING
  -- ============================================================================
  INSERT INTO public.user_daily_challenge_completions (
    user_id, challenge_id, challenge_date, bonus_xp_awarded, time_spent_seconds, completed_at
  ) VALUES (
    v_user_id, v_challenge.id, v_challenge.challenge_date, v_challenge.bonus_xp, COALESCE(p_time_spent_seconds, 0), NOW()
  )
  ON CONFLICT (user_id, challenge_id) DO NOTHING
  RETURNING id INTO v_new_completion_id;

  -- If concurrent insert slipped in between check and insert:
  IF v_new_completion_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_correct', true,
      'correct_option', v_clean_correct,
      'explanation', v_question.explanation,
      'bonus_xp', 0,
      'question_xp', 0,
      'already_completed', true,
      'streak', v_streak.current_streak,
      'longest_streak', v_streak.longest_streak,
      'message', 'Daily challenge already completed. Bonus already claimed for today.'
    );
  END IF;

  -- ============================================================================
  -- 9. Advance streak safely (only once per calendar day)
  -- ============================================================================
  IF v_streak.last_active_date = v_today THEN
    -- Already active today through earlier activity: maintain streak
    v_new_streak := v_streak.current_streak;
  ELSIF v_streak.last_active_date = v_today - 1 THEN
    -- Consecutive day: increment streak
    v_new_streak := v_streak.current_streak + 1;
  ELSE
    -- Missed day or first activity ever: start at 1
    v_new_streak := 1;
  END IF;

  v_longest_streak := GREATEST(COALESCE(v_streak.longest_streak, 0), v_new_streak);

  UPDATE public.user_streaks
  SET current_streak = v_new_streak,
      longest_streak = v_longest_streak,
      last_active_date = v_today,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  -- ============================================================================
  -- 10. Upsert question progress (solved)
  -- ============================================================================
  INSERT INTO public.user_question_progress (
    user_id, question_id, selected_option, is_solved, is_correct, attempts_count, time_spent_seconds, last_attempted_at
  ) VALUES (
    v_user_id, v_question.id, v_clean_selected, true, true, v_attempt_number, COALESCE(p_time_spent_seconds, 0), NOW()
  )
  ON CONFLICT (user_id, question_id) DO UPDATE
  SET is_solved = true,
      is_correct = true,
      attempts_count = user_question_progress.attempts_count + 1,
      time_spent_seconds = user_question_progress.time_spent_seconds + EXCLUDED.time_spent_seconds,
      selected_option = EXCLUDED.selected_option,
      last_attempted_at = NOW();

  -- ============================================================================
  -- 11. Log attempt in user_question_attempts (+question points if not already solved)
  -- ============================================================================
  INSERT INTO public.user_question_attempts (
    user_id, question_id, selected_option, is_correct, xp_change, attempt_number, time_spent_seconds, created_at
  ) VALUES (
    v_user_id, v_question.id, v_clean_selected, true, 
    CASE WHEN v_was_already_solved THEN 0 ELSE v_question.points END, 
    v_attempt_number, COALESCE(p_time_spent_seconds, 0), NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_correct', true,
    'correct_option', v_clean_correct,
    'explanation', v_question.explanation,
    'bonus_xp', v_challenge.bonus_xp,
    'question_xp', CASE WHEN v_was_already_solved THEN 0 ELSE v_question.points END,
    'already_completed', false,
    'streak', v_new_streak,
    'longest_streak', v_longest_streak,
    'message', 'Daily challenge completed! +50 Bonus XP awarded.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_daily_challenge(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_daily_challenge(UUID, TEXT, INTEGER, TEXT) TO authenticated, service_role;


-- ==============================================================================
-- 7. SECURE RPC: record_streak_activity
-- Called on Question Bank correct solves. Advances streak idempotently.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.record_streak_activity(p_timezone TEXT DEFAULT 'UTC')
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tz TEXT;
  v_today DATE;
  v_streak RECORD;
  v_new_streak INTEGER;
  v_longest_streak INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate timezone
  IF p_timezone IS NOT NULL AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    v_tz := p_timezone;
  ELSE
    v_tz := 'UTC';
  END IF;

  v_today := (NOW() AT TIME ZONE v_tz)::date;

  -- Row lock streak record
  INSERT INTO public.user_streaks (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak
  FROM public.user_streaks
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- If user already active today on this calendar day, NO STREAK CHANGE!
  IF v_streak.last_active_date = v_today THEN
    RETURN jsonb_build_object(
      'success', true,
      'streak', v_streak.current_streak,
      'longest_streak', v_streak.longest_streak,
      'updated', false,
      'message', 'Already active today'
    );
  END IF;

  -- Consecutive day vs missed day
  IF v_streak.last_active_date = v_today - 1 THEN
    v_new_streak := v_streak.current_streak + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  v_longest_streak := GREATEST(COALESCE(v_streak.longest_streak, 0), v_new_streak);

  UPDATE public.user_streaks
  SET current_streak = v_new_streak,
      longest_streak = v_longest_streak,
      last_active_date = v_today,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'streak', v_new_streak,
    'longest_streak', v_longest_streak,
    'updated', true,
    'message', 'Streak updated'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_streak_activity(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_streak_activity(TEXT) TO authenticated, service_role;


-- ==============================================================================
-- 8. SECURE RPC: get_user_streak
-- Read-only dynamic display resolution. ZERO database mutations.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_user_streak(p_timezone TEXT DEFAULT 'UTC')
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tz TEXT;
  v_today DATE;
  v_streak RECORD;
  v_days_diff INTEGER;
  v_display_streak INTEGER := 0;
  v_is_active_today BOOLEAN := FALSE;
  v_is_at_risk BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'current_streak', 0,
      'longest_streak', 0,
      'is_active_today', false,
      'is_at_risk', false,
      'last_active_date', null
    );
  END IF;

  IF p_timezone IS NOT NULL AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_timezone) THEN
    v_tz := p_timezone;
  ELSE
    v_tz := 'UTC';
  END IF;

  v_today := (NOW() AT TIME ZONE v_tz)::date;

  SELECT * INTO v_streak
  FROM public.user_streaks
  WHERE user_id = v_user_id;

  IF v_streak.user_id IS NULL OR v_streak.last_active_date IS NULL THEN
    RETURN jsonb_build_object(
      'current_streak', 0,
      'longest_streak', COALESCE(v_streak.longest_streak, 0),
      'is_active_today', false,
      'is_at_risk', false,
      'last_active_date', null
    );
  END IF;

  v_days_diff := v_today - v_streak.last_active_date;

  IF v_days_diff = 0 THEN
    -- Active today
    v_display_streak := v_streak.current_streak;
    v_is_active_today := TRUE;
    v_is_at_risk := FALSE;
  ELSIF v_days_diff = 1 THEN
    -- Active yesterday, pending today's activity
    v_display_streak := v_streak.current_streak;
    v_is_active_today := FALSE;
    v_is_at_risk := TRUE;
  ELSE
    -- Missed more than 1 day: Streak is lapsed
    v_display_streak := 0;
    v_is_active_today := FALSE;
    v_is_at_risk := FALSE;
  END IF;

  RETURN jsonb_build_object(
    'current_streak', v_display_streak,
    'longest_streak', v_streak.longest_streak,
    'is_active_today', v_is_active_today,
    'is_at_risk', v_is_at_risk,
    'last_active_date', v_streak.last_active_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_streak(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_streak(TEXT) TO anon, authenticated, service_role;
