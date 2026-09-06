-- ==============================================================================
-- MODULE 5: ADMIN & MODERATOR CONTROL CENTER
-- STEP 3: QUESTION BANK MANAGEMENT MIGRATION
-- ==============================================================================
-- Security Principles:
--   1. Normal users can only SELECT active questions (is_active = TRUE).
--   2. Staff (moderator & admin) can SELECT all questions (active and inactive).
--   3. Privileged mutations (create, update, toggle active, delete) are conducted
--      EXCLUSIVELY via SECURITY DEFINER RPCs authorized by public.is_moderator_or_admin().
--   4. No direct INSERT, UPDATE, or DELETE policies exist on public.questions for client roles.
--   5. Sequential Question ID generation is concurrency-safe and race-condition-proof
--      via atomic row locking on public.question_sequences and primary key constraint.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CONCURRENCY-SAFE SEQUENCE TRACKER FOR QUESTION IDS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.question_sequences (
  prefix TEXT PRIMARY KEY,
  last_val INTEGER NOT NULL CHECK (last_val >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS (No direct client access; managed strictly via SECURITY DEFINER RPCs)
ALTER TABLE public.question_sequences ENABLE ROW LEVEL SECURITY;

-- Seed sequence tracker from current maximum values in public.questions
INSERT INTO public.question_sequences (prefix, last_val)
VALUES
  (
    'quant',
    COALESCE((
      SELECT MAX(SUBSTRING(id FROM 7)::integer)
      FROM public.questions
      WHERE id LIKE 'quant-%' AND id ~ '^quant-[0-9]+$'
    ), 80)
  ),
  (
    'lr',
    COALESCE((
      SELECT MAX(SUBSTRING(id FROM 4)::integer)
      FROM public.questions
      WHERE id LIKE 'lr-%' AND id ~ '^lr-[0-9]+$'
    ), 50)
  ),
  (
    'di',
    COALESCE((
      SELECT MAX(SUBSTRING(id FROM 4)::integer)
      FROM public.questions
      WHERE id LIKE 'di-%' AND id ~ '^di-[0-9]+$'
    ), 35)
  ),
  (
    'verbal',
    COALESCE((
      SELECT MAX(SUBSTRING(id FROM 8)::integer)
      FROM public.questions
      WHERE id LIKE 'verbal-%' AND id ~ '^verbal-[0-9]+$'
    ), 35)
  )
ON CONFLICT (prefix) DO UPDATE
SET last_val = GREATEST(question_sequences.last_val, EXCLUDED.last_val),
    updated_at = NOW();


-- ------------------------------------------------------------------------------
-- 2. RLS POLICIES & TABLE PERMISSIONS ON public.questions
-- ------------------------------------------------------------------------------
-- Keep existing public policy: Active questions viewable by everyone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'questions'
      AND policyname = 'Active questions are viewable by everyone'
  ) THEN
    CREATE POLICY "Active questions are viewable by everyone"
      ON public.questions FOR SELECT
      USING (is_active = TRUE);
  END IF;
END $$;

-- Staff SELECT policy: Moderators and Admins can view ALL questions (active and inactive)
DROP POLICY IF EXISTS "Staff can view all questions" ON public.questions;
CREATE POLICY "Staff can view all questions"
  ON public.questions FOR SELECT
  USING (public.is_moderator_or_admin());

-- Explicitly ensure NO direct client INSERT, UPDATE, or DELETE policies exist on questions
DROP POLICY IF EXISTS "Staff can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Staff can update questions" ON public.questions;
DROP POLICY IF EXISTS "Staff can delete questions" ON public.questions;
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Authenticated users can update questions" ON public.questions;
DROP POLICY IF EXISTS "Authenticated users can delete questions" ON public.questions;

-- Restrict direct table privileges for client roles
-- Normal users and staff clients are granted SELECT only.
-- All mutations MUST proceed through authorized SECURITY DEFINER RPCs.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.questions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.questions TO anon, authenticated;

-- Ensure question_sequences is completely inaccessible directly to clients
REVOKE ALL ON TABLE public.question_sequences FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------------------------
-- 3. RPC: staff_get_next_question_id (Concurrency-Safe Sequential ID Generator)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_get_next_question_id(p_category TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prefix TEXT;
  v_next_val INTEGER;
  v_max_existing INTEGER;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Staff clearance required.';
  END IF;

  -- 2. Determine prefix by category (strict: explicit error, no silent fallback)
  CASE p_category
    WHEN 'Quantitative Aptitude' THEN v_prefix := 'quant';
    WHEN 'Logical Reasoning' THEN v_prefix := 'lr';
    WHEN 'Data Interpretation' THEN v_prefix := 'di';
    WHEN 'Verbal & Abstract' THEN v_prefix := 'verbal';
    ELSE
      RAISE EXCEPTION 'Invalid category: "%". Supported categories are Quantitative Aptitude, Logical Reasoning, Data Interpretation, and Verbal & Abstract.', p_category;
  END CASE;

  -- 3. Ensure sequence row exists
  INSERT INTO public.question_sequences (prefix, last_val)
  VALUES (v_prefix, 0)
  ON CONFLICT (prefix) DO NOTHING;

  -- 4. Acquire exclusive transaction row lock on the sequence record (blocks concurrent transactions)
  PERFORM 1 FROM public.question_sequences
  WHERE prefix = v_prefix
  FOR UPDATE;

  -- 5. Find current maximum existing number in public.questions for this prefix
  SELECT COALESCE(MAX(SUBSTRING(id FROM length(v_prefix) + 2)::integer), 0)
  INTO v_max_existing
  FROM public.questions
  WHERE id LIKE v_prefix || '-%' AND id ~ ('^' || v_prefix || '-[0-9]+$');

  -- 6. Atomic increment: advance last_val to GREATEST(current + 1, table_max + 1)
  UPDATE public.question_sequences
  SET last_val = GREATEST(last_val + 1, v_max_existing + 1),
      updated_at = NOW()
  WHERE prefix = v_prefix
  RETURNING last_val INTO v_next_val;

  -- 7. Format sequential ID (e.g. quant-081, lr-051)
  -- Note: public.questions primary key uniqueness constraint remains the final safeguard
  RETURN v_prefix || '-' || LPAD(v_next_val::text, 3, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.staff_get_next_question_id(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_get_next_question_id(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_get_next_question_id(TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. RPC: staff_create_question (Author & Validate New Question)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_create_question(
  p_title TEXT,
  p_prompt TEXT,
  p_category TEXT,
  p_topic TEXT,
  p_difficulty TEXT,
  p_options JSONB,
  p_correct_option TEXT,
  p_explanation TEXT,
  p_formula_or_rule TEXT DEFAULT NULL,
  p_hints JSONB DEFAULT '[]'::jsonb,
  p_points INTEGER DEFAULT 10,
  p_tags JSONB DEFAULT '[]'::jsonb,
  p_is_active BOOLEAN DEFAULT FALSE,
  p_custom_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id TEXT;
  v_prefix TEXT;
  v_trimmed_correct TEXT;
  v_opt_count INTEGER;
  v_valid_opt_count INTEGER;
  v_created_row RECORD;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Field validations
  IF p_title IS NULL OR TRIM(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TITLE', 'message', 'Question title cannot be empty.');
  END IF;

  IF p_prompt IS NULL OR TRIM(p_prompt) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PROMPT', 'message', 'Question prompt cannot be empty.');
  END IF;

  -- Strict category validation & prefix resolution
  CASE p_category
    WHEN 'Quantitative Aptitude' THEN v_prefix := 'quant';
    WHEN 'Logical Reasoning' THEN v_prefix := 'lr';
    WHEN 'Data Interpretation' THEN v_prefix := 'di';
    WHEN 'Verbal & Abstract' THEN v_prefix := 'verbal';
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_CATEGORY',
        'message', 'Category must be one of Quantitative Aptitude, Logical Reasoning, Data Interpretation, or Verbal & Abstract.'
      );
  END CASE;

  IF p_topic IS NULL OR TRIM(p_topic) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TOPIC', 'message', 'Question topic cannot be empty.');
  END IF;

  IF p_difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DIFFICULTY', 'message', 'Difficulty must be easy, medium, or hard.');
  END IF;

  -- 3. Options validation: Must be a JSON array with EXACTLY 4 elements with IDs A, B, C, D and non-empty text
  IF p_options IS NULL OR jsonb_typeof(p_options) != 'array' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_OPTIONS', 'message', 'Options must be a valid JSON array.');
  END IF;

  SELECT count(*) INTO v_opt_count FROM jsonb_array_elements(p_options);
  IF v_opt_count != 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_OPTIONS_COUNT', 'message', 'Question must contain exactly 4 options (A, B, C, D).');
  END IF;

  -- Validate that options contain distinct IDs A, B, C, D and each has non-empty text
  SELECT count(DISTINCT UPPER(TRIM(elem->>'id')))
  INTO v_valid_opt_count
  FROM jsonb_array_elements(p_options) elem
  WHERE UPPER(TRIM(elem->>'id')) IN ('A', 'B', 'C', 'D')
    AND elem->>'text' IS NOT NULL
    AND TRIM(elem->>'text') != '';

  IF v_valid_opt_count != 4 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_OPTIONS_STRUCTURE',
      'message', 'Options must have exactly 4 items with distinct IDs A, B, C, and D, and each must have non-empty text.'
    );
  END IF;

  -- 4. Correct option validation: must be strictly one of A, B, C, D
  v_trimmed_correct := TRIM(UPPER(COALESCE(p_correct_option, '')));
  IF v_trimmed_correct NOT IN ('A', 'B', 'C', 'D') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_CORRECT_OPTION',
      'message', 'Correct option must be exactly one of A, B, C, or D.'
    );
  END IF;

  IF p_explanation IS NULL OR TRIM(p_explanation) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_EXPLANATION', 'message', 'Explanation is required.');
  END IF;

  -- 5. Determine Question ID (Custom format validation vs Concurrency-safe sequence)
  IF p_custom_id IS NOT NULL AND TRIM(p_custom_id) != '' THEN
    v_id := LOWER(TRIM(p_custom_id));

    -- Format validation: must match category prefix followed by hyphen and at least 3 digits (e.g. quant-081)
    IF NOT (v_id ~ ('^' || v_prefix || '-[0-9]{3,}$')) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_CUSTOM_ID_FORMAT',
        'message', 'Custom ID for ' || p_category || ' must follow the format "' || v_prefix || '-NNN" (e.g. ' || v_prefix || '-081).'
      );
    END IF;

    -- Uniqueness check
    IF EXISTS (SELECT 1 FROM public.questions WHERE id = v_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_ID', 'message', 'Question with ID "' || v_id || '" already exists.');
    END IF;

    -- Ensure sequence tracker cannot move backwards (only advance with GREATEST)
    INSERT INTO public.question_sequences (prefix, last_val)
    VALUES (v_prefix, 0)
    ON CONFLICT (prefix) DO NOTHING;

    UPDATE public.question_sequences
    SET last_val = GREATEST(last_val, SUBSTRING(v_id FROM length(v_prefix) + 2)::integer),
        updated_at = NOW()
    WHERE prefix = v_prefix;
  ELSE
    -- Generate sequential ID atomically
    v_id := public.staff_get_next_question_id(p_category);
  END IF;

  -- 6. Insert Question (Defaults to inactive for review)
  INSERT INTO public.questions (
    id, title, prompt, category, topic, difficulty, options, correct_option,
    explanation, formula_or_rule, hints, points, acceptance_rate, tags, is_active,
    created_at, updated_at
  ) VALUES (
    v_id,
    TRIM(p_title),
    TRIM(p_prompt),
    p_category,
    TRIM(p_topic),
    p_difficulty,
    p_options,
    v_trimmed_correct,
    TRIM(p_explanation),
    NULLIF(TRIM(p_formula_or_rule), ''),
    COALESCE(p_hints, '[]'::jsonb),
    GREATEST(5, COALESCE(p_points, 10)),
    0,
    COALESCE(p_tags, '[]'::jsonb),
    COALESCE(p_is_active, FALSE),
    NOW(),
    NOW()
  )
  RETURNING * INTO v_created_row;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Question successfully created.',
    'question', row_to_json(v_created_row)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_create_question(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, INTEGER, JSONB, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_create_question(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, INTEGER, JSONB, BOOLEAN, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_create_question(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, INTEGER, JSONB, BOOLEAN, TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. RPC: staff_update_question (Edit Question Fields with Consistent Validation)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_update_question(
  p_question_id TEXT,
  p_title TEXT,
  p_prompt TEXT,
  p_category TEXT,
  p_topic TEXT,
  p_difficulty TEXT,
  p_options JSONB,
  p_correct_option TEXT,
  p_explanation TEXT,
  p_formula_or_rule TEXT DEFAULT NULL,
  p_hints JSONB DEFAULT NULL,
  p_points INTEGER DEFAULT NULL,
  p_tags JSONB DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trimmed_correct TEXT;
  v_opt_count INTEGER;
  v_valid_opt_count INTEGER;
  v_updated_row RECORD;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Verify existence
  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE id = p_question_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Question not found.');
  END IF;

  -- 3. Field validations (consistent with create validation)
  IF p_title IS NULL OR TRIM(p_title) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TITLE', 'message', 'Question title cannot be empty.');
  END IF;

  IF p_prompt IS NULL OR TRIM(p_prompt) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_PROMPT', 'message', 'Question prompt cannot be empty.');
  END IF;

  IF p_category NOT IN ('Quantitative Aptitude', 'Logical Reasoning', 'Data Interpretation', 'Verbal & Abstract') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CATEGORY', 'message', 'Invalid category. Supported categories are Quantitative Aptitude, Logical Reasoning, Data Interpretation, and Verbal & Abstract.');
  END IF;

  IF p_topic IS NULL OR TRIM(p_topic) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_TOPIC', 'message', 'Question topic cannot be empty.');
  END IF;

  IF p_difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_DIFFICULTY', 'message', 'Difficulty must be easy, medium, or hard.');
  END IF;

  -- 4. Options validation: Must be exactly 4 elements with IDs A, B, C, D and non-empty text
  IF p_options IS NOT NULL THEN
    IF jsonb_typeof(p_options) != 'array' THEN
      RETURN jsonb_build_object('success', false, 'error', 'INVALID_OPTIONS', 'message', 'Options must be a valid JSON array.');
    END IF;

    SELECT count(*) INTO v_opt_count FROM jsonb_array_elements(p_options);
    IF v_opt_count != 4 THEN
      RETURN jsonb_build_object('success', false, 'error', 'INVALID_OPTIONS_COUNT', 'message', 'Question must contain exactly 4 options (A, B, C, D).');
    END IF;

    SELECT count(DISTINCT UPPER(TRIM(elem->>'id')))
    INTO v_valid_opt_count
    FROM jsonb_array_elements(p_options) elem
    WHERE UPPER(TRIM(elem->>'id')) IN ('A', 'B', 'C', 'D')
      AND elem->>'text' IS NOT NULL
      AND TRIM(elem->>'text') != '';

    IF v_valid_opt_count != 4 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_OPTIONS_STRUCTURE',
        'message', 'Options must have exactly 4 items with distinct IDs A, B, C, and D, and each must have non-empty text.'
      );
    END IF;
  END IF;

  -- Correct option validation
  IF p_correct_option IS NOT NULL THEN
    v_trimmed_correct := TRIM(UPPER(p_correct_option));
    IF v_trimmed_correct NOT IN ('A', 'B', 'C', 'D') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'INVALID_CORRECT_OPTION',
        'message', 'Correct option must be exactly one of A, B, C, or D.'
      );
    END IF;
  END IF;

  IF p_explanation IS NOT NULL AND TRIM(p_explanation) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_EXPLANATION', 'message', 'Explanation cannot be empty.');
  END IF;

  -- 5. Execute Update
  UPDATE public.questions
  SET title = TRIM(p_title),
      prompt = TRIM(p_prompt),
      category = p_category,
      topic = TRIM(p_topic),
      difficulty = p_difficulty,
      options = COALESCE(p_options, options),
      correct_option = COALESCE(v_trimmed_correct, correct_option),
      explanation = COALESCE(NULLIF(TRIM(p_explanation), ''), explanation),
      formula_or_rule = NULLIF(TRIM(p_formula_or_rule), ''),
      hints = COALESCE(p_hints, hints),
      points = COALESCE(p_points, points),
      tags = COALESCE(p_tags, tags),
      is_active = COALESCE(p_is_active, is_active),
      updated_at = NOW()
  WHERE id = p_question_id
  RETURNING * INTO v_updated_row;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Question successfully updated.',
    'question', row_to_json(v_updated_row)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_update_question(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, INTEGER, JSONB, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_update_question(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, INTEGER, JSONB, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_update_question(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, JSONB, INTEGER, JSONB, BOOLEAN) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. RPC: staff_toggle_question_active (Activate / Deactivate Question)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_toggle_question_active(
  p_question_id TEXT,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_in_live_contest BOOLEAN;
  v_updated_status BOOLEAN;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Verify question exists
  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE id = p_question_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Question not found.');
  END IF;

  -- 3. Safety: If deactivating, check if question is part of an active / live contest
  IF p_is_active IS FALSE THEN
    SELECT EXISTS (
      SELECT 1 FROM public.contest_questions cq
      JOIN public.contests c ON c.id = cq.contest_id
      WHERE cq.question_id = p_question_id
        AND c.is_active = TRUE
        AND (
          c.status = 'live' 
          OR (c.status = 'upcoming' AND NOW() >= c.start_time AND NOW() < c.end_time)
        )
    ) INTO v_is_in_live_contest;

    IF v_is_in_live_contest THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'QUESTION_IN_LIVE_CONTEST',
        'message', 'Cannot deactivate a question currently deployed in an active or live Contest.'
      );
    END IF;
  END IF;

  -- 4. Update status
  UPDATE public.questions
  SET is_active = p_is_active,
      updated_at = NOW()
  WHERE id = p_question_id
  RETURNING is_active INTO v_updated_status;

  RETURN jsonb_build_object(
    'success', true,
    'question_id', p_question_id,
    'is_active', v_updated_status,
    'message', 'Question active status successfully updated.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_toggle_question_active(TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_toggle_question_active(TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_toggle_question_active(TEXT, BOOLEAN) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 7. RPC: staff_delete_question (Safe Delete with Integrity Protections)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_delete_question(p_question_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_attempts BOOLEAN;
  v_has_contest_links BOOLEAN;
BEGIN
  -- 1. Authorization check
  IF NOT public.is_moderator_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Staff clearance required.');
  END IF;

  -- 2. Verify question exists
  IF NOT EXISTS (SELECT 1 FROM public.questions WHERE id = p_question_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_FOUND', 'message', 'Question not found.');
  END IF;

  -- 3. Check for contest mappings
  SELECT EXISTS (
    SELECT 1 FROM public.contest_questions WHERE question_id = p_question_id
  ) INTO v_has_contest_links;

  IF v_has_contest_links THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUESTION_ASSIGNED_TO_CONTEST',
      'message', 'Cannot delete question assigned to one or more contests. Deactivate it instead.'
    );
  END IF;

  -- 4. Check for existing attempts / progress
  SELECT EXISTS (
    SELECT 1 FROM public.user_question_attempts WHERE question_id = p_question_id
  ) INTO v_has_attempts;

  IF v_has_attempts THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'QUESTION_HAS_USER_ATTEMPTS',
      'message', 'Cannot delete question with existing student attempt history. Deactivate it instead to preserve analytics.'
    );
  END IF;

  -- 5. Delete question row
  DELETE FROM public.questions WHERE id = p_question_id;

  RETURN jsonb_build_object(
    'success', true,
    'question_id', p_question_id,
    'message', 'Question successfully deleted.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_delete_question(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_delete_question(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_delete_question(TEXT) TO authenticated, service_role;
