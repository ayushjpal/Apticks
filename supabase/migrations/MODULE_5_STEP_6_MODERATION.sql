-- ==============================================================================
-- MODULE 5: ADMIN & MODERATOR CONTROL CENTER
-- STEP 6: MODERATION & INCIDENT MANAGEMENT MIGRATION
-- ==============================================================================
-- Purpose:
-- 1. Create public.moderation_reports table with strict constraints, audit fields,
--    and high-performance indexing.
-- 2. Configure Row Level Security (RLS) and table permissions so normal users and staff
--    can view permitted reports, while direct table INSERT, UPDATE, and DELETE are strictly
--    revoked/blocked. All submissions occur exclusively via create_moderation_report().
-- 3. Enforce server-authoritative state machine transitions and full immutability:
--      pending   -> reviewing, dismissed (notes editable)
--      reviewing -> resolved, dismissed (notes editable)
--      resolved  -> terminal (notes locked, fully immutable)
--      dismissed -> terminal (notes locked, fully immutable)
-- 4. Provide concurrency-safe SECURITY DEFINER RPCs for:
--      - staff_get_moderation_metrics()
--      - staff_list_moderation_incidents()
--      - staff_get_incident_detail()
--      - staff_update_incident_status()
--      - staff_update_incident_notes()
--      - create_moderation_report()
-- 5. Zero destruction to existing Module 2, 3, 4, 5 data or tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.moderation_reports
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  moderator_notes TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Target Type Constraint
  CONSTRAINT chk_moderation_target_type
    CHECK (target_type IN ('question', 'contest', 'user', 'general')),

  -- Reason Category Constraint
  CONSTRAINT chk_moderation_reason
    CHECK (reason IN (
      'question_errata',
      'question_clarity',
      'inappropriate_content',
      'cheating_suspicion',
      'technical_issue',
      'other'
    )),

  -- Description Minimum Length Constraint
  CONSTRAINT chk_moderation_description_len
    CHECK (length(trim(description)) >= 5),

  -- Status Constraint
  CONSTRAINT chk_moderation_status
    CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed'))
);

-- ------------------------------------------------------------------------------
-- 2. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_moderation_reports_status 
  ON public.moderation_reports(status);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_target 
  ON public.moderation_reports(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_reporter 
  ON public.moderation_reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_created 
  ON public.moderation_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_reason
  ON public.moderation_reports(reason);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) & PRIVILEGES
-- ------------------------------------------------------------------------------
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS p_moderation_reports_select_user ON public.moderation_reports;
DROP POLICY IF EXISTS p_moderation_reports_select_staff ON public.moderation_reports;
DROP POLICY IF EXISTS p_moderation_reports_insert_user ON public.moderation_reports;
DROP POLICY IF EXISTS p_moderation_reports_update_staff ON public.moderation_reports;
DROP POLICY IF EXISTS p_moderation_reports_delete_staff ON public.moderation_reports;

-- Policy 1: Authenticated normal users can view ONLY their own reports
CREATE POLICY p_moderation_reports_select_user
  ON public.moderation_reports
  FOR SELECT
  TO authenticated
  USING (
    reporter_id = auth.uid()
  );

-- Policy 2: Staff (moderator or admin) can view ALL moderation reports
CREATE POLICY p_moderation_reports_select_staff
  ON public.moderation_reports
  FOR SELECT
  TO authenticated
  USING (
    public.is_moderator_or_admin() = true
  );

-- Revoke direct table modifications from public, anon, and authenticated
REVOKE INSERT, UPDATE, DELETE ON TABLE public.moderation_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.moderation_reports TO authenticated;
GRANT ALL ON TABLE public.moderation_reports TO service_role;

-- NOTE: Direct client-side INSERT, UPDATE, and DELETE are strictly BLOCKED.
-- There is NO INSERT policy for authenticated or staff users.
-- Normal users and staff MUST submit incident reports via create_moderation_report().
-- All triage and status mutations MUST occur through authoritative staff RPCs.

-- ------------------------------------------------------------------------------
-- 4. RPC: staff_get_moderation_metrics()
-- Returns accurate database counts for the staff moderation dashboard
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_get_moderation_metrics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pending INT;
  v_reviewing INT;
  v_resolved INT;
  v_dismissed INT;
  v_total INT;
BEGIN
  -- Security check: caller must be moderator or admin
  IF public.is_moderator_or_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to inspect moderation metrics.';
  END IF;

  SELECT
    count(*) FILTER (WHERE status = 'pending'),
    count(*) FILTER (WHERE status = 'reviewing'),
    count(*) FILTER (WHERE status = 'resolved'),
    count(*) FILTER (WHERE status = 'dismissed'),
    count(*)
  INTO
    v_pending,
    v_reviewing,
    v_resolved,
    v_dismissed,
    v_total
  FROM public.moderation_reports;

  RETURN jsonb_build_object(
    'pending', COALESCE(v_pending, 0),
    'reviewing', COALESCE(v_reviewing, 0),
    'resolved', COALESCE(v_resolved, 0),
    'dismissed', COALESCE(v_dismissed, 0),
    'total', COALESCE(v_total, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_get_moderation_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_get_moderation_metrics() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. RPC: staff_list_moderation_incidents()
-- Paginated incident listing with reporter profile join and filter options
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_list_moderation_incidents(
  p_status TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
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
  v_results JSONB;
  v_total_filtered INT;
BEGIN
  -- Security check: caller must be moderator or admin
  IF public.is_moderator_or_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to list moderation incidents.';
  END IF;

  -- Bounded limit
  IF p_limit < 1 OR p_limit > 100 THEN
    p_limit := 50;
  END IF;

  IF p_offset < 0 THEN
    p_offset := 0;
  END IF;

  -- Count total matching filter
  SELECT count(*)
  INTO v_total_filtered
  FROM public.moderation_reports r
  LEFT JOIN public.profiles rep ON r.reporter_id = rep.id
  WHERE
    (p_status IS NULL OR p_status = 'all' OR r.status = p_status)
    AND (p_reason IS NULL OR p_reason = 'all' OR r.reason = p_reason)
    AND (
      p_search IS NULL OR trim(p_search) = '' OR
      r.id::text ILIKE '%' || trim(p_search) || '%' OR
      r.target_id ILIKE '%' || trim(p_search) || '%' OR
      r.description ILIKE '%' || trim(p_search) || '%' OR
      rep.username ILIKE '%' || trim(p_search) || '%' OR
      rep.display_name ILIKE '%' || trim(p_search) || '%'
    );

  -- Fetch items with joined profiles
  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
  INTO v_results
  FROM (
    SELECT
      r.id,
      r.reporter_id,
      r.target_type,
      r.target_id,
      r.reason,
      r.description,
      r.status,
      r.moderator_notes,
      r.resolved_by,
      r.resolved_at,
      r.created_at,
      r.updated_at,
      jsonb_build_object(
        'id', rep.id,
        'username', rep.username,
        'display_name', rep.display_name,
        'avatar_url', rep.avatar_url
      ) AS reporter,
      CASE
        WHEN res.id IS NOT NULL THEN
          jsonb_build_object(
            'id', res.id,
            'username', res.username,
            'display_name', res.display_name
          )
        ELSE NULL
      END AS resolver
    FROM public.moderation_reports r
    LEFT JOIN public.profiles rep ON r.reporter_id = rep.id
    LEFT JOIN public.profiles res ON r.resolved_by = res.id
    WHERE
      (p_status IS NULL OR p_status = 'all' OR r.status = p_status)
      AND (p_reason IS NULL OR p_reason = 'all' OR r.reason = p_reason)
      AND (
        p_search IS NULL OR trim(p_search) = '' OR
        r.id::text ILIKE '%' || trim(p_search) || '%' OR
        r.target_id ILIKE '%' || trim(p_search) || '%' OR
        r.description ILIKE '%' || trim(p_search) || '%' OR
        rep.username ILIKE '%' || trim(p_search) || '%' OR
        rep.display_name ILIKE '%' || trim(p_search) || '%'
      )
    ORDER BY
      CASE r.status
        WHEN 'pending' THEN 1
        WHEN 'reviewing' THEN 2
        WHEN 'resolved' THEN 3
        WHEN 'dismissed' THEN 4
        ELSE 5
      END ASC,
      r.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) item;

  RETURN jsonb_build_object(
    'incidents', v_results,
    'total', v_total_filtered,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_moderation_incidents(TEXT, TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_list_moderation_incidents(TEXT, TEXT, TEXT, INT, INT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC: staff_get_incident_detail()
-- Detailed incident inspection including target entity context
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_get_incident_detail(
  p_report_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report RECORD;
  v_reporter RECORD;
  v_resolver RECORD;
  v_target_context JSONB := NULL;
  v_q RECORD;
  v_c RECORD;
  v_p RECORD;
BEGIN
  -- Security check: caller must be moderator or admin
  IF public.is_moderator_or_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to view incident details.';
  END IF;

  SELECT * INTO v_report
  FROM public.moderation_reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incident report not found: %', p_report_id;
  END IF;

  -- Fetch reporter info
  SELECT id, username, display_name, avatar_url INTO v_reporter
  FROM public.profiles
  WHERE id = v_report.reporter_id;

  -- Fetch resolver info if resolved
  IF v_report.resolved_by IS NOT NULL THEN
    SELECT id, username, display_name INTO v_resolver
    FROM public.profiles
    WHERE id = v_report.resolved_by;
  END IF;

  -- Contextual target information lookups
  IF v_report.target_type = 'question' THEN
    SELECT id, title, prompt, category, topic, difficulty, is_active
    INTO v_q
    FROM public.questions
    WHERE id = v_report.target_id;

    IF FOUND THEN
      v_target_context := jsonb_build_object(
        'type', 'question',
        'id', v_q.id,
        'title', v_q.title,
        'prompt', v_q.prompt,
        'category', v_q.category,
        'topic', v_q.topic,
        'difficulty', v_q.difficulty,
        'is_active', v_q.is_active
      );
    ELSE
      v_target_context := jsonb_build_object(
        'type', 'question',
        'id', v_report.target_id,
        'missing', true
      );
    END IF;

  ELSIF v_report.target_type = 'contest' THEN
    SELECT id, slug, title, status, category, difficulty
    INTO v_c
    FROM public.contests
    WHERE id::text = v_report.target_id OR slug = v_report.target_id;

    IF FOUND THEN
      v_target_context := jsonb_build_object(
        'type', 'contest',
        'id', v_c.id,
        'slug', v_c.slug,
        'title', v_c.title,
        'status', v_c.status,
        'category', v_c.category,
        'difficulty', v_c.difficulty
      );
    ELSE
      v_target_context := jsonb_build_object(
        'type', 'contest',
        'id', v_report.target_id,
        'missing', true
      );
    END IF;

  ELSIF v_report.target_type = 'user' THEN
    SELECT id, username, display_name, role, created_at
    INTO v_p
    FROM public.profiles
    WHERE id::text = v_report.target_id OR username = v_report.target_id;

    IF FOUND THEN
      v_target_context := jsonb_build_object(
        'type', 'user',
        'id', v_p.id,
        'username', v_p.username,
        'display_name', v_p.display_name,
        'role', v_p.role,
        'created_at', v_p.created_at
      );
    ELSE
      v_target_context := jsonb_build_object(
        'type', 'user',
        'id', v_report.target_id,
        'missing', true
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', v_report.id,
    'reporter_id', v_report.reporter_id,
    'target_type', v_report.target_type,
    'target_id', v_report.target_id,
    'reason', v_report.reason,
    'description', v_report.description,
    'status', v_report.status,
    'moderator_notes', v_report.moderator_notes,
    'resolved_by', v_report.resolved_by,
    'resolved_at', v_report.resolved_at,
    'created_at', v_report.created_at,
    'updated_at', v_report.updated_at,
    'reporter', jsonb_build_object(
      'id', v_reporter.id,
      'username', v_reporter.username,
      'display_name', v_reporter.display_name,
      'avatar_url', v_reporter.avatar_url
    ),
    'resolver', CASE
      WHEN v_resolver.id IS NOT NULL THEN
        jsonb_build_object(
          'id', v_resolver.id,
          'username', v_resolver.username,
          'display_name', v_resolver.display_name
        )
      ELSE NULL
    END,
    'target_context', v_target_context
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_get_incident_detail(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_get_incident_detail(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. RPC: staff_update_incident_status()
-- Concurrency-safe state machine transition enforcement
-- Allowed transitions:
--   pending   -> reviewing, dismissed
--   reviewing -> resolved, dismissed
--   resolved  -> terminal (idempotent if same status)
--   dismissed -> terminal (idempotent if same status)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_update_incident_status(
  p_report_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report RECORD;
  v_caller_id UUID;
  v_valid_transition BOOLEAN := FALSE;
BEGIN
  -- Security check: caller must be moderator or admin
  IF public.is_moderator_or_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to modify moderation incident status.';
  END IF;

  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: authenticated caller required.';
  END IF;

  -- Validate target status value
  IF p_new_status NOT IN ('pending', 'reviewing', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'INVALID_STATUS: % is not a recognized moderation status.', p_new_status;
  END IF;

  -- Lock row with FOR UPDATE to prevent concurrency race conditions
  SELECT * INTO v_report
  FROM public.moderation_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORT_NOT_FOUND: Incident report with ID % does not exist.', p_report_id;
  END IF;

  -- Idempotency: re-applying the identical status is a no-op success
  IF v_report.status = p_new_status THEN
    -- If already terminal, notes are strictly locked and cannot be updated
    IF v_report.status NOT IN ('resolved', 'dismissed') AND p_notes IS NOT NULL THEN
      UPDATE public.moderation_reports
      SET moderator_notes = p_notes, updated_at = NOW()
      WHERE id = p_report_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'report_id', p_report_id,
      'status', p_new_status,
      'message', 'Incident status already set (idempotent).'
    );
  END IF;

  -- Validate Allowed State Machine Transitions
  IF v_report.status = 'pending' AND p_new_status IN ('reviewing', 'dismissed') THEN
    v_valid_transition := TRUE;
  ELSIF v_report.status = 'reviewing' AND p_new_status IN ('resolved', 'dismissed') THEN
    v_valid_transition := TRUE;
  ELSIF v_report.status IN ('resolved', 'dismissed') THEN
    -- Terminal states cannot be changed to another status
    RAISE EXCEPTION 'ILLEGAL_TRANSITION: Cannot change terminal status % to %.', v_report.status, p_new_status;
  ELSE
    RAISE EXCEPTION 'ILLEGAL_TRANSITION: Transition from % to % is not permitted by the moderation state machine.', v_report.status, p_new_status;
  END IF;

  -- Apply atomic status transition
  UPDATE public.moderation_reports
  SET
    status = p_new_status,
    moderator_notes = COALESCE(p_notes, moderator_notes),
    resolved_by = CASE
      WHEN p_new_status IN ('resolved', 'dismissed') THEN v_caller_id
      ELSE resolved_by
    END,
    resolved_at = CASE
      WHEN p_new_status IN ('resolved', 'dismissed') THEN NOW()
      ELSE resolved_at
    END,
    updated_at = NOW()
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'previous_status', v_report.status,
    'new_status', p_new_status,
    'resolved_by', CASE WHEN p_new_status IN ('resolved', 'dismissed') THEN v_caller_id ELSE v_report.resolved_by END,
    'updated_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_update_incident_status(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_update_incident_status(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. RPC: staff_update_incident_notes()
-- Concurrency-safe notes calibration without altering status
-- Terminal incidents (resolved, dismissed) are strictly immutable (notes locked).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_update_incident_notes(
  p_report_id UUID,
  p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report RECORD;
BEGIN
  -- Security check: caller must be moderator or admin
  IF public.is_moderator_or_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to update incident notes.';
  END IF;

  SELECT * INTO v_report
  FROM public.moderation_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORT_NOT_FOUND: Incident report with ID % does not exist.', p_report_id;
  END IF;

  -- Terminal incidents are fully immutable: notes cannot be modified once resolved or dismissed
  IF v_report.status IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'INCIDENT_TERMINAL: Cannot modify notes for a % incident. Terminal reports are immutable.', v_report.status;
  END IF;

  UPDATE public.moderation_reports
  SET
    moderator_notes = p_notes,
    updated_at = NOW()
  WHERE id = p_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'notes', p_notes,
    'updated_at', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_update_incident_notes(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_update_incident_notes(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 9. RPC: create_moderation_report()
-- Validated user-facing report creation function with target entity verification
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_moderation_report(
  p_target_type TEXT,
  p_target_id TEXT,
  p_reason TEXT,
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_new_id UUID;
  v_target_found BOOLEAN := FALSE;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User must be signed in to submit an incident report.';
  END IF;

  -- Validate inputs
  IF p_target_type NOT IN ('question', 'contest', 'user', 'general') THEN
    RAISE EXCEPTION 'INVALID_TARGET_TYPE: % is not a valid report target type.', p_target_type;
  END IF;

  IF p_reason NOT IN (
    'question_errata',
    'question_clarity',
    'inappropriate_content',
    'cheating_suspicion',
    'technical_issue',
    'other'
  ) THEN
    RAISE EXCEPTION 'INVALID_REASON: % is not a valid incident report reason category.', p_reason;
  END IF;

  IF length(trim(p_description)) < 5 THEN
    RAISE EXCEPTION 'DESCRIPTION_TOO_SHORT: Description must be at least 5 characters long.';
  END IF;

  -- Target existence verification
  IF p_target_type = 'question' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.questions WHERE id = p_target_id
    ) INTO v_target_found;

    IF NOT v_target_found THEN
      RAISE EXCEPTION 'TARGET_QUESTION_NOT_FOUND: Question % does not exist.', p_target_id;
    END IF;

  ELSIF p_target_type = 'contest' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.contests WHERE id::text = p_target_id OR slug = p_target_id
    ) INTO v_target_found;

    IF NOT v_target_found THEN
      RAISE EXCEPTION 'TARGET_CONTEST_NOT_FOUND: Contest % does not exist.', p_target_id;
    END IF;

  ELSIF p_target_type = 'user' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles WHERE id::text = p_target_id OR username = p_target_id
    ) INTO v_target_found;

    IF NOT v_target_found THEN
      RAISE EXCEPTION 'TARGET_USER_NOT_FOUND: User % does not exist.', p_target_id;
    END IF;

  ELSIF p_target_type = 'general' THEN
    v_target_found := TRUE;
  END IF;

  -- Insert report with safe defaults (moderator and resolution fields strictly server-controlled / NULL)
  INSERT INTO public.moderation_reports (
    reporter_id,
    target_type,
    target_id,
    reason,
    description,
    status,
    moderator_notes,
    resolved_by,
    resolved_at
  ) VALUES (
    v_caller_id,
    p_target_type,
    p_target_id,
    p_reason,
    trim(p_description),
    'pending',
    NULL,
    NULL,
    NULL
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', v_new_id,
    'status', 'pending',
    'message', 'Incident report successfully recorded.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_moderation_report(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_moderation_report(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
