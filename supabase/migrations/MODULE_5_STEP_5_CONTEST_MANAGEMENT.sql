-- ==============================================================================
-- MODULE 5 — STEP 5: CONTEST MANAGEMENT MIGRATION (AUDITED & HARDENED)
-- ==============================================================================
-- Purpose:
-- 1. Extend `public.contests.status` check constraint to support 'draft' (fails loudly).
-- 2. Add non-breaking `contest_type` and `banner_url` columns to `public.contests`.
-- 3. Add staff SELECT policies for contests, contest_questions, and contest_participants.
-- 4. Provide server-authoritative SECURITY DEFINER RPCs for staff contest lifecycle:
--    - staff_create_contest
--    - staff_update_contest
--    - staff_set_contest_status
--    - staff_add_contest_question
--    - staff_remove_contest_question
--    - staff_reorder_contest_questions
--    - staff_delete_contest
--    - staff_get_contest_questions
-- 5. Strict lifecycle state machine:
--    - draft -> upcoming, cancelled
--    - upcoming -> draft (only if 0 participants), live, cancelled
--    - live -> completed, cancelled
--    - completed -> terminal
--    - cancelled -> terminal
-- 6. Strict question assignment & ordering rules:
--    - Only questions with is_active = true can be assigned to contests
--    - Reorder requires exact 1:1 match of all currently assigned question IDs without duplicates
--    - Malformed reorder input returns error with ZERO database modifications
-- 7. Concurrency controls:
--    - Target contest rows locked via SELECT ... FOR UPDATE across all mutation RPCs
--    - Prevents race conditions on order_index, question totals, and status transitions
-- 8. Publish / Activation validation:
--    - Upcoming/live contests must have >= 1 question, verified totals, and valid timings
-- 9. Zero regression on existing 3 contests, 15 dedicated questions, and player arena RPCs.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA EXTENSIONS
-- ------------------------------------------------------------------------------

-- Update status check constraint to include 'draft' (Fails loudly on error)
ALTER TABLE public.contests DROP CONSTRAINT IF EXISTS contests_status_check;
ALTER TABLE public.contests ADD CONSTRAINT contests_status_check
  CHECK (status IN ('draft', 'upcoming', 'live', 'completed', 'cancelled'));

-- Add non-breaking contest_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'contest_type'
  ) THEN
    ALTER TABLE public.contests 
      ADD COLUMN contest_type TEXT NOT NULL DEFAULT 'weekly' 
      CHECK (contest_type IN ('daily', 'weekly', 'custom', 'special'));
  END IF;
END $$;

-- Add non-breaking banner_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'contests' AND column_name = 'banner_url'
  ) THEN
    ALTER TABLE public.contests ADD COLUMN banner_url TEXT;
  END IF;
END $$;

-- Create index for fast status and type lookups
CREATE INDEX IF NOT EXISTS idx_contests_staff_filter ON public.contests (status, contest_type, created_at DESC);


-- ------------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY: STAFF SELECT POLICIES
-- ------------------------------------------------------------------------------

-- Staff can view all contests (including draft and inactive)
DROP POLICY IF EXISTS "Staff can view all contests" ON public.contests;
CREATE POLICY "Staff can view all contests" 
ON public.contests FOR SELECT 
TO authenticated 
USING (public.is_moderator_or_admin());

-- Staff can view all contest question mappings
DROP POLICY IF EXISTS "Staff can view all contest questions" ON public.contest_questions;
CREATE POLICY "Staff can view all contest questions" 
ON public.contest_questions FOR SELECT 
TO authenticated 
USING (public.is_moderator_or_admin());

-- Staff can view all contest participants (for monitoring and oversight)
DROP POLICY IF EXISTS "Staff can view all contest participants" ON public.contest_participants;
CREATE POLICY "Staff can view all contest participants" 
ON public.contest_participants FOR SELECT 
TO authenticated 
USING (public.is_moderator_or_admin());


-- ------------------------------------------------------------------------------
-- 3. STAFF RPC 1: staff_create_contest
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_create_contest(
  p_title TEXT,
  p_slug TEXT,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT 'Quantitative Aptitude',
  p_difficulty TEXT DEFAULT 'open',
  p_contest_type TEXT DEFAULT 'weekly',
  p_start_time TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day'),
  p_end_time TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 day 1 hour'),
  p_duration_minutes INTEGER DEFAULT 30,
  p_positive_marks NUMERIC DEFAULT 4.00,
  p_negative_marks NUMERIC DEFAULT 1.00,
  p_xp_pool INTEGER DEFAULT 1000,
  p_rules TEXT DEFAULT NULL,
  p_syllabus TEXT DEFAULT NULL,
  p_banner_url TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'draft'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contest_id UUID;
  v_normalized_slug TEXT;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Staff clearance required to create contests.'
    );
  END IF;

  -- 2. Validate title
  IF p_title IS NULL OR TRIM(p_title) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TITLE',
      'message', 'Contest title cannot be empty.'
    );
  END IF;

  -- 3. Validate slug
  v_normalized_slug := LOWER(TRIM(p_slug));
  IF v_normalized_slug IS NULL OR v_normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_SLUG',
      'message', 'Slug must contain only lowercase alphanumeric characters separated by single hyphens.'
    );
  END IF;

  -- Check slug uniqueness
  IF EXISTS (SELECT 1 FROM public.contests WHERE slug = v_normalized_slug) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SLUG_EXISTS',
      'message', 'A contest with this slug already exists.'
    );
  END IF;

  -- 4. Validate timings
  IF p_start_time IS NULL OR p_end_time IS NULL OR p_end_time <= p_start_time THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TIMING',
      'message', 'End time must be strictly after start time.'
    );
  END IF;

  IF p_duration_minutes IS NULL OR p_duration_minutes <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_DURATION',
      'message', 'Duration must be greater than zero minutes.'
    );
  END IF;

  -- 5. Validate marking
  IF p_positive_marks IS NULL OR p_positive_marks <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_POSITIVE_MARKS',
      'message', 'Positive marks per question must be greater than zero.'
    );
  END IF;

  IF p_negative_marks IS NULL OR p_negative_marks < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_NEGATIVE_MARKS',
      'message', 'Negative marks cannot be negative.'
    );
  END IF;

  -- 6. Validate initial status
  -- New contests must be created in 'draft' status with zero questions.
  -- Upcoming and live contests must never exist with zero questions.
  IF p_status IS NOT NULL AND p_status != 'draft' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INITIAL_STATUS_MUST_BE_DRAFT',
      'message', 'New contests must be created in draft state. Questions must be assigned before publishing as upcoming.'
    );
  END IF;

  -- Validate difficulty
  IF p_difficulty NOT IN ('easy', 'medium', 'hard', 'open', 'master') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_DIFFICULTY',
      'message', 'Difficulty must be easy, medium, hard, open, or master.'
    );
  END IF;

  -- Validate contest_type
  IF p_contest_type NOT IN ('daily', 'weekly', 'custom', 'special') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_CONTEST_TYPE',
      'message', 'Contest type must be daily, weekly, custom, or special.'
    );
  END IF;

  -- 7. Insert Contest in draft state
  INSERT INTO public.contests (
    title,
    slug,
    description,
    category,
    difficulty,
    contest_type,
    status,
    start_time,
    end_time,
    duration_minutes,
    total_questions,
    total_marks,
    positive_marks_per_question,
    negative_marks_per_question,
    xp_pool,
    rules,
    syllabus,
    banner_url,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    TRIM(p_title),
    v_normalized_slug,
    NULLIF(TRIM(p_description), ''),
    p_category,
    p_difficulty,
    p_contest_type,
    'draft',
    p_start_time,
    p_end_time,
    p_duration_minutes,
    0,
    0.00,
    p_positive_marks,
    p_negative_marks,
    COALESCE(p_xp_pool, 1000),
    NULLIF(TRIM(p_rules), ''),
    NULLIF(TRIM(p_syllabus), ''),
    NULLIF(TRIM(p_banner_url), ''),
    FALSE,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_contest_id;

  RETURN jsonb_build_object(
    'success', true,
    'contest_id', v_contest_id,
    'slug', v_normalized_slug,
    'status', 'draft',
    'message', 'Contest created successfully in draft state.'
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 4. STAFF RPC 2: staff_update_contest
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_update_contest(
  p_contest_id UUID,
  p_title TEXT DEFAULT NULL,
  p_slug TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_difficulty TEXT DEFAULT NULL,
  p_contest_type TEXT DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT NULL,
  p_positive_marks NUMERIC DEFAULT NULL,
  p_negative_marks NUMERIC DEFAULT NULL,
  p_xp_pool INTEGER DEFAULT NULL,
  p_rules TEXT DEFAULT NULL,
  p_syllabus TEXT DEFAULT NULL,
  p_banner_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contest RECORD;
  v_active_participants_count INTEGER;
  v_normalized_slug TEXT;
  v_eff_title TEXT;
  v_eff_description TEXT;
  v_eff_category TEXT;
  v_eff_difficulty TEXT;
  v_eff_contest_type TEXT;
  v_eff_start_time TIMESTAMPTZ;
  v_eff_end_time TIMESTAMPTZ;
  v_eff_duration INTEGER;
  v_eff_pos_marks NUMERIC;
  v_eff_neg_marks NUMERIC;
  v_eff_xp_pool INTEGER;
  v_eff_rules TEXT;
  v_eff_syllabus TEXT;
  v_eff_banner_url TEXT;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Concurrency lock on target contest row
  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Contest not found.');
  END IF;

  -- 3. Completed and cancelled contests are read-only
  IF v_contest.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CONTEST_IMMUTABLE',
      'message', format('%s contests cannot be modified.', INITCAP(v_contest.status))
    );
  END IF;

  -- 4. Calculate effective values (partial update semantics preserve existing fields when NULL)
  v_eff_title := COALESCE(NULLIF(TRIM(p_title), ''), v_contest.title);
  v_eff_description := COALESCE(p_description, v_contest.description);
  v_eff_category := COALESCE(NULLIF(TRIM(p_category), ''), v_contest.category);
  v_eff_difficulty := COALESCE(NULLIF(TRIM(p_difficulty), ''), v_contest.difficulty);
  v_eff_contest_type := COALESCE(NULLIF(TRIM(p_contest_type), ''), v_contest.contest_type);
  v_eff_start_time := COALESCE(p_start_time, v_contest.start_time);
  v_eff_end_time := COALESCE(p_end_time, v_contest.end_time);
  v_eff_duration := COALESCE(p_duration_minutes, v_contest.duration_minutes);
  v_eff_pos_marks := COALESCE(p_positive_marks, v_contest.positive_marks_per_question);
  v_eff_neg_marks := COALESCE(p_negative_marks, v_contest.negative_marks_per_question);
  v_eff_xp_pool := COALESCE(p_xp_pool, v_contest.xp_pool);
  v_eff_rules := COALESCE(p_rules, v_contest.rules);
  v_eff_syllabus := COALESCE(p_syllabus, v_contest.syllabus);
  v_eff_banner_url := COALESCE(p_banner_url, v_contest.banner_url);

  -- 5. Check active participants if live
  IF v_contest.status = 'live' THEN
    SELECT count(*) INTO v_active_participants_count
    FROM public.contest_participants
    WHERE contest_id = p_contest_id AND started_at IS NOT NULL;

    IF v_active_participants_count > 0 THEN
      IF v_eff_start_time != v_contest.start_time
         OR v_eff_end_time != v_contest.end_time
         OR v_eff_duration != v_contest.duration_minutes
         OR v_eff_pos_marks != v_contest.positive_marks_per_question
         OR v_eff_neg_marks != v_contest.negative_marks_per_question THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'CONTEST_IN_PROGRESS',
          'message', 'Cannot alter timing or marking scheme while participants are taking the live contest.'
        );
      END IF;
    END IF;
  END IF;

  -- 6. Validate slug if provided
  IF p_slug IS NOT NULL AND TRIM(p_slug) != '' THEN
    v_normalized_slug := LOWER(TRIM(p_slug));
    IF v_normalized_slug != v_contest.slug THEN
      IF v_normalized_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_SLUG', 'message', 'Malformed slug format.');
      END IF;

      IF EXISTS (SELECT 1 FROM public.contests WHERE slug = v_normalized_slug AND id != p_contest_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'SLUG_EXISTS', 'message', 'A contest with this slug already exists.');
      END IF;
    END IF;
  ELSE
    v_normalized_slug := v_contest.slug;
  END IF;

  -- 7. Validate effective values
  IF v_eff_end_time <= v_eff_start_time THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TIMING', 'message', 'End time must be strictly after start time.');
  END IF;

  IF v_eff_duration <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DURATION', 'message', 'Duration must be greater than zero minutes.');
  END IF;

  IF v_eff_pos_marks <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_POSITIVE_MARKS', 'message', 'Positive marks must be greater than zero.');
  END IF;

  IF v_eff_neg_marks < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_NEGATIVE_MARKS', 'message', 'Negative marks cannot be negative.');
  END IF;

  IF v_eff_difficulty NOT IN ('easy', 'medium', 'hard', 'open', 'master') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DIFFICULTY', 'message', 'Invalid difficulty level.');
  END IF;

  IF v_eff_contest_type NOT IN ('daily', 'weekly', 'custom', 'special') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CONTEST_TYPE', 'message', 'Invalid contest type.');
  END IF;

  -- 8. Execute update
  UPDATE public.contests
  SET
    title = v_eff_title,
    slug = v_normalized_slug,
    description = v_eff_description,
    category = v_eff_category,
    difficulty = v_eff_difficulty,
    contest_type = v_eff_contest_type,
    start_time = v_eff_start_time,
    end_time = v_eff_end_time,
    duration_minutes = v_eff_duration,
    positive_marks_per_question = v_eff_pos_marks,
    negative_marks_per_question = v_eff_neg_marks,
    xp_pool = v_eff_xp_pool,
    rules = v_eff_rules,
    syllabus = v_eff_syllabus,
    banner_url = v_eff_banner_url,
    updated_at = NOW()
  WHERE id = p_contest_id;

  RETURN jsonb_build_object(
    'success', true,
    'contest_id', p_contest_id,
    'message', 'Contest updated successfully.'
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. STAFF RPC 3: staff_set_contest_status
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_set_contest_status(
  p_contest_id UUID,
  p_new_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contest RECORD;
  v_participants_count INTEGER;
  v_new_is_active BOOLEAN;
  v_actual_questions INTEGER;
  v_actual_marks NUMERIC;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Validate target status
  IF p_new_status NOT IN ('draft', 'upcoming', 'live', 'completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_STATUS', 'message', 'Invalid status value.');
  END IF;

  -- 3. Concurrency lock on contest row
  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Contest not found.');
  END IF;

  -- 4. Idempotency check
  IF v_contest.status = p_new_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'contest_id', p_contest_id,
      'status', p_new_status,
      'message', format('Contest status is already %s.', p_new_status)
    );
  END IF;

  -- 5. Terminal states check (completed & cancelled cannot change status)
  IF v_contest.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'TERMINAL_STATE',
      'message', format('%s contests are in a terminal state and cannot transition to %s.', INITCAP(v_contest.status), p_new_status)
    );
  END IF;

  -- 6. Strict lifecycle state machine enforcement
  IF v_contest.status = 'draft' THEN
    IF p_new_status NOT IN ('upcoming', 'cancelled') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_TRANSITION',
        'message', format('Invalid transition: draft contests can only transition to "upcoming" or "cancelled", not "%s".', p_new_status)
      );
    END IF;
  ELSIF v_contest.status = 'upcoming' THEN
    IF p_new_status NOT IN ('draft', 'live', 'cancelled') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_TRANSITION',
        'message', format('Invalid transition: upcoming contests can only transition to "draft", "live", or "cancelled", not "%s".', p_new_status)
      );
    END IF;

    -- Reverting to draft allowed only if 0 participants have registered
    IF p_new_status = 'draft' THEN
      SELECT count(*) INTO v_participants_count 
      FROM public.contest_participants 
      WHERE contest_id = p_contest_id;

      IF v_participants_count > 0 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'CANNOT_REVERT_TO_DRAFT',
          'message', 'Contest has registered participants. Cancel the contest instead of reverting to draft.'
        );
      END IF;
    END IF;
  ELSIF v_contest.status = 'live' THEN
    IF p_new_status NOT IN ('completed', 'cancelled') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_TRANSITION',
        'message', format('Invalid transition: live contests can only transition to "completed" or "cancelled", not "%s".', p_new_status)
      );
    END IF;
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TRANSITION',
      'message', format('Unrecognized source contest status "%s".', v_contest.status)
    );
  END IF;

  -- 7. Publish / Activation Validation (draft -> upcoming OR upcoming -> live)
  IF (v_contest.status = 'draft' AND p_new_status = 'upcoming') 
     OR (v_contest.status = 'upcoming' AND p_new_status = 'live') THEN

    SELECT count(*), COALESCE(SUM(marks), 0.00)
    INTO v_actual_questions, v_actual_marks
    FROM public.contest_questions
    WHERE contest_id = p_contest_id;

    -- Must have at least 1 question
    IF v_actual_questions = 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'NO_QUESTIONS',
        'message', 'A contest must have at least 1 assigned question before publication or activation.'
      );
    END IF;

    -- Timing validation
    IF v_contest.start_time IS NULL OR v_contest.end_time IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_TIMING',
        'message', 'Contest start time and end time cannot be null.'
      );
    END IF;

    IF v_contest.end_time <= v_contest.start_time THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_TIMING',
        'message', 'Contest end time must be strictly after start time.'
      );
    END IF;

    -- Timing appropriate for state
    IF p_new_status = 'upcoming' THEN
      IF v_contest.end_time <= NOW() THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'CONTEST_ALREADY_ENDED',
          'message', 'Cannot publish contest as upcoming because its scheduled end time is already in the past.'
        );
      END IF;
    ELSIF p_new_status = 'live' THEN
      IF NOW() < v_contest.start_time THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'START_TIME_IN_FUTURE',
          'message', 'Cannot transition contest to live before its scheduled start time. Update start time first.'
        );
      END IF;

      IF NOW() >= v_contest.end_time THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'CONTEST_ALREADY_ENDED',
          'message', 'Cannot transition contest to live because its scheduled end time has already passed.'
        );
      END IF;
    END IF;
  ELSE
    -- For transitions to cancelled or completed, query actual counts for sync
    SELECT count(*), COALESCE(SUM(marks), 0.00)
    INTO v_actual_questions, v_actual_marks
    FROM public.contest_questions
    WHERE contest_id = p_contest_id;
  END IF;

  -- 8. Determine active flag
  IF p_new_status IN ('draft', 'cancelled') THEN
    v_new_is_active := FALSE;
  ELSE
    v_new_is_active := TRUE;
  END IF;

  -- 9. Update status, active flag, and ensure totals match actual mappings
  UPDATE public.contests
  SET status = p_new_status,
      is_active = v_new_is_active,
      total_questions = v_actual_questions,
      total_marks = v_actual_marks,
      updated_at = NOW()
  WHERE id = p_contest_id;

  RETURN jsonb_build_object(
    'success', true,
    'contest_id', p_contest_id,
    'previous_status', v_contest.status,
    'new_status', p_new_status,
    'is_active', v_new_is_active,
    'total_questions', v_actual_questions,
    'total_marks', v_actual_marks,
    'message', format('Contest status transitioned from %s to %s.', v_contest.status, p_new_status)
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 6. STAFF RPC 4: staff_add_contest_question
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_add_contest_question(
  p_contest_id UUID,
  p_question_id TEXT,
  p_marks NUMERIC DEFAULT 4.00,
  p_negative_marks NUMERIC DEFAULT 1.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contest RECORD;
  v_q_is_active BOOLEAN;
  v_next_order INTEGER;
  v_new_total_questions INTEGER;
  v_new_total_marks NUMERIC;
  v_active_participants INTEGER;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Concurrency lock on target contest row
  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONTEST_NOT_FOUND', 'message', 'Contest not found.');
  END IF;

  IF v_contest.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONTEST_INACTIVE', 'message', 'Cannot add questions to an ended or cancelled contest.');
  END IF;

  IF v_contest.status = 'live' THEN
    SELECT count(*) INTO v_active_participants 
    FROM public.contest_participants 
    WHERE contest_id = p_contest_id AND started_at IS NOT NULL;

    IF v_active_participants > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'CONTEST_IN_PROGRESS', 'message', 'Cannot alter questions while a contest is live with active participants.');
    END IF;
  END IF;

  -- 3. Question checks & Activation rule
  -- Only questions with is_active = true can be added to contests
  SELECT is_active INTO v_q_is_active 
  FROM public.questions 
  WHERE id = p_question_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'QUESTION_NOT_FOUND', 'message', 'Question ID does not exist in Question Bank.');
  END IF;

  IF NOT v_q_is_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUESTION_INACTIVE',
      'message', 'Only active questions from the Question Bank can be assigned to contests.'
    );
  END IF;

  -- Prevent duplicate assignment
  IF EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND question_id = p_question_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_QUESTION', 'message', 'Question is already assigned to this contest.');
  END IF;

  -- 4. Calculate next order index (serialized safely under contest row lock)
  SELECT COALESCE(MAX(order_index), 0) + 1 INTO v_next_order
  FROM public.contest_questions
  WHERE contest_id = p_contest_id;

  -- 5. Insert mapping
  INSERT INTO public.contest_questions (
    contest_id,
    question_id,
    order_index,
    marks,
    negative_marks,
    created_at
  ) VALUES (
    p_contest_id,
    p_question_id,
    v_next_order,
    COALESCE(p_marks, v_contest.positive_marks_per_question),
    COALESCE(p_negative_marks, v_contest.negative_marks_per_question),
    NOW()
  );

  -- 6. Atomically update contest totals
  SELECT count(*), COALESCE(SUM(marks), 0.00)
  INTO v_new_total_questions, v_new_total_marks
  FROM public.contest_questions
  WHERE contest_id = p_contest_id;

  UPDATE public.contests
  SET total_questions = v_new_total_questions,
      total_marks = v_new_total_marks,
      updated_at = NOW()
  WHERE id = p_contest_id;

  RETURN jsonb_build_object(
    'success', true,
    'contest_id', p_contest_id,
    'question_id', p_question_id,
    'order_index', v_next_order,
    'total_questions', v_new_total_questions,
    'total_marks', v_new_total_marks,
    'message', 'Question added to contest successfully.'
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 7. STAFF RPC 5: staff_remove_contest_question
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_remove_contest_question(
  p_contest_id UUID,
  p_question_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contest RECORD;
  v_active_participants INTEGER;
  v_new_total_questions INTEGER;
  v_new_total_marks NUMERIC;
  v_current_count INTEGER;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Concurrency lock on target contest row
  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONTEST_NOT_FOUND', 'message', 'Contest not found.');
  END IF;

  IF v_contest.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONTEST_INACTIVE', 'message', 'Cannot remove questions from an ended or cancelled contest.');
  END IF;

  IF v_contest.status = 'live' THEN
    SELECT count(*) INTO v_active_participants 
    FROM public.contest_participants 
    WHERE contest_id = p_contest_id AND started_at IS NOT NULL;

    IF v_active_participants > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'CONTEST_IN_PROGRESS', 'message', 'Cannot remove questions while a contest is live with active participants.');
    END IF;
  END IF;

  -- 3. Check mapping exists
  IF NOT EXISTS (SELECT 1 FROM public.contest_questions WHERE contest_id = p_contest_id AND question_id = p_question_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'QUESTION_NOT_IN_CONTEST', 'message', 'Question is not assigned to this contest.');
  END IF;

  -- 4. Publish / Activation protection: upcoming or live contests cannot exist with zero questions
  IF v_contest.status IN ('upcoming', 'live') THEN
    SELECT count(*) INTO v_current_count 
    FROM public.contest_questions 
    WHERE contest_id = p_contest_id;

    IF v_current_count <= 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'CANNOT_REMOVE_LAST_QUESTION',
        'message', 'Cannot remove the last question from an upcoming or live contest. Revert contest to draft or cancel it first.'
      );
    END IF;
  END IF;

  -- 5. Delete mapping
  DELETE FROM public.contest_questions
  WHERE contest_id = p_contest_id AND question_id = p_question_id;

  -- 6. Safely re-compact order_index avoiding unique constraint conflicts
  UPDATE public.contest_questions
  SET order_index = -order_index
  WHERE contest_id = p_contest_id;

  WITH reordered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY -order_index ASC) AS new_order
    FROM public.contest_questions
    WHERE contest_id = p_contest_id
  )
  UPDATE public.contest_questions cq
  SET order_index = r.new_order
  FROM reordered r
  WHERE cq.id = r.id;

  -- 7. Atomically update totals
  SELECT count(*), COALESCE(SUM(marks), 0.00)
  INTO v_new_total_questions, v_new_total_marks
  FROM public.contest_questions
  WHERE contest_id = p_contest_id;

  UPDATE public.contests
  SET total_questions = v_new_total_questions,
      total_marks = v_new_total_marks,
      updated_at = NOW()
  WHERE id = p_contest_id;

  RETURN jsonb_build_object(
    'success', true,
    'contest_id', p_contest_id,
    'removed_question_id', p_question_id,
    'total_questions', v_new_total_questions,
    'total_marks', v_new_total_marks,
    'message', 'Question removed from contest successfully.'
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 8. STAFF RPC 6: staff_reorder_contest_questions (HARDENED)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_reorder_contest_questions(
  p_contest_id UUID,
  p_question_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contest RECORD;
  v_active_participants INTEGER;
  v_existing_count INTEGER;
  v_distinct_input_count INTEGER;
  v_matched_count INTEGER;
  v_idx INTEGER;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Concurrency lock on target contest row
  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONTEST_NOT_FOUND', 'message', 'Contest not found.');
  END IF;

  IF v_contest.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONTEST_INACTIVE', 'message', 'Cannot reorder questions for completed or cancelled contests.');
  END IF;

  IF v_contest.status = 'live' THEN
    SELECT count(*) INTO v_active_participants 
    FROM public.contest_participants 
    WHERE contest_id = p_contest_id AND started_at IS NOT NULL;

    IF v_active_participants > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'CONTEST_IN_PROGRESS', 'message', 'Cannot reorder questions while contest is live with active participants.');
    END IF;
  END IF;

  -- 3. Validate p_question_ids is non-null and non-empty
  IF p_question_ids IS NULL OR array_length(p_question_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_REORDER_PAYLOAD',
      'message', 'Question IDs array cannot be null or empty.'
    );
  END IF;

  -- 4. Validate exact count match with existing mappings
  SELECT count(*) INTO v_existing_count 
  FROM public.contest_questions 
  WHERE contest_id = p_contest_id;

  IF array_length(p_question_ids, 1) != v_existing_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_QUESTION_COUNT',
      'message', format('Reorder array length (%s) does not match total assigned questions (%s). Partial reordering is forbidden.', array_length(p_question_ids, 1), v_existing_count)
    );
  END IF;

  -- 5. Validate no duplicates in input array
  SELECT count(DISTINCT q) INTO v_distinct_input_count 
  FROM unnest(p_question_ids) AS q;

  IF v_distinct_input_count != array_length(p_question_ids, 1) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'DUPLICATE_QUESTION_IDS',
      'message', 'Reorder array contains duplicate question IDs.'
    );
  END IF;

  -- 6. Validate every question ID belongs to this contest (strictly 1:1 match)
  SELECT count(*) INTO v_matched_count
  FROM public.contest_questions
  WHERE contest_id = p_contest_id AND question_id = ANY(p_question_ids);

  IF v_matched_count != v_existing_count THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNKNOWN_OR_UNASSIGNED_QUESTION',
      'message', 'Reorder array contains question IDs that are not assigned to this contest or is missing assigned questions.'
    );
  END IF;

  -- 7. Execute reordering safely without violating UNIQUE (contest_id, order_index)
  -- Step A: Negate existing order indices
  UPDATE public.contest_questions
  SET order_index = -order_index
  WHERE contest_id = p_contest_id;

  -- Step B: Assign exact 1-based order index matching input array
  FOR v_idx IN 1..array_length(p_question_ids, 1)
  LOOP
    UPDATE public.contest_questions
    SET order_index = v_idx
    WHERE contest_id = p_contest_id AND question_id = p_question_ids[v_idx];
  END LOOP;

  UPDATE public.contests
  SET updated_at = NOW()
  WHERE id = p_contest_id;

  RETURN jsonb_build_object(
    'success', true,
    'contest_id', p_contest_id,
    'reordered_count', array_length(p_question_ids, 1),
    'message', 'Contest questions reordered successfully.'
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 9. STAFF RPC 7: staff_delete_contest
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_delete_contest(
  p_contest_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contest RECORD;
  v_participants_count INTEGER;
  v_answers_count INTEGER;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Concurrency lock on target contest row
  SELECT * INTO v_contest 
  FROM public.contests 
  WHERE id = p_contest_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'CONTEST_NOT_FOUND', 'message', 'Contest not found.');
  END IF;

  -- 3. Deletion safety guards: live and completed contests are protected
  IF v_contest.status IN ('live', 'completed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CANNOT_DELETE_ACTIVE_OR_COMPLETED',
      'message', 'Live and completed contests cannot be deleted. Cancel the contest instead.'
    );
  END IF;

  SELECT count(*) INTO v_participants_count 
  FROM public.contest_participants 
  WHERE contest_id = p_contest_id;

  IF v_participants_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CONTEST_HAS_PARTICIPANTS',
      'message', 'Contest has participants registered or historical records. Cancellation is required instead of deletion.'
    );
  END IF;

  SELECT count(*) INTO v_answers_count 
  FROM public.contest_answers 
  WHERE contest_id = p_contest_id;

  IF v_answers_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'CONTEST_HAS_ANSWERS',
      'message', 'Contest contains participant answer submissions. Deletion is forbidden.'
    );
  END IF;

  -- 4. Delete questions mappings and contest
  DELETE FROM public.contest_questions WHERE contest_id = p_contest_id;
  DELETE FROM public.contests WHERE id = p_contest_id;

  RETURN jsonb_build_object(
    'success', true,
    'contest_id', p_contest_id,
    'deleted_title', v_contest.title,
    'message', 'Contest deleted successfully.'
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 10. STAFF RPC 8: staff_get_contest_questions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_get_contest_questions(
  p_contest_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_questions JSONB;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Aggregate assigned questions with rich details
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'mapping_id', cq.id,
        'question_id', cq.question_id,
        'order_index', cq.order_index,
        'marks', cq.marks,
        'negative_marks', cq.negative_marks,
        'title', q.title,
        'prompt', q.prompt,
        'category', q.category,
        'topic', q.topic,
        'difficulty', q.difficulty,
        'options', q.options,
        'correct_option', q.correct_option,
        'explanation', q.explanation,
        'formula', q.formula,
        'hints', q.hints,
        'tags', q.tags,
        'is_active', q.is_active
      )
      ORDER BY cq.order_index ASC
    ),
    '[]'::JSONB
  ) INTO v_questions
  FROM public.contest_questions cq
  JOIN public.questions q ON q.id = cq.question_id
  WHERE cq.contest_id = p_contest_id;

  RETURN jsonb_build_object(
    'success', true,
    'contest_id', p_contest_id,
    'questions', v_questions
  );
END;
$$;


-- ------------------------------------------------------------------------------
-- 11. GRANT EXECUTION PRIVILEGES
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.staff_create_contest(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, NUMERIC, NUMERIC, INTEGER, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_create_contest(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, NUMERIC, NUMERIC, INTEGER, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.staff_update_contest(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, NUMERIC, NUMERIC, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_update_contest(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, NUMERIC, NUMERIC, INTEGER, TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.staff_set_contest_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_set_contest_status(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.staff_add_contest_question(UUID, TEXT, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_add_contest_question(UUID, TEXT, NUMERIC, NUMERIC) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.staff_remove_contest_question(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_remove_contest_question(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.staff_reorder_contest_questions(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_reorder_contest_questions(UUID, TEXT[]) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.staff_delete_contest(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_delete_contest(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.staff_get_contest_questions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_get_contest_questions(UUID) TO authenticated, service_role;
