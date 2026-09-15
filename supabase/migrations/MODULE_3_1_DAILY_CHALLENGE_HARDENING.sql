-- ==============================================================================
-- MODULE 3.1 — DAILY CHALLENGE HARDENING & RE-ATTEMPT LOOPHOLE FIX
-- ==============================================================================
-- Prevents duplicate +50 Bonus XP, duplicate question points, duplicate completions,
-- streak manipulation, and penalties on already-completed Daily Challenges.
--
-- Security Enhancements:
-- 1. Immediate completion guard: If today's challenge was already completed,
--    immediately returns an idempotent already-completed response BEFORE checking
--    options or applying penalties.
-- 2. Calendar-day binding: Uses v_challenge.challenge_date rather than divergent
--    client timezones to anchor completions.
-- 3. Concurrency serialization: Uses row-level locking on user_streaks (FOR UPDATE)
--    and ON CONFLICT DO NOTHING on user_daily_challenge_completions to prevent
--    concurrent duplicate reward injection.
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
