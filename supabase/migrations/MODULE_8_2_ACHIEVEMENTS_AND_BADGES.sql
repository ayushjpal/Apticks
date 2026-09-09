-- ==============================================================================
-- MODULE 8.2: ACHIEVEMENTS & BADGES SYSTEM
-- Authoritative badge catalog, user ownership ledger, RLS protection,
-- automated server-side evaluation, and progress calculation.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table: public.badges (Active Badge Catalog)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.badges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('practice', 'streak', 'xp', 'accuracy', 'contest', 'special')),
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  icon TEXT NOT NULL,
  criteria_type TEXT NOT NULL CHECK (criteria_type IN ('solved_count', 'streak_days', 'total_xp', 'accuracy_percentage', 'contests_count', 'special')),
  criteria_threshold NUMERIC NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Table: public.user_badges (Immutable Ownership Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_id TEXT REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges(badge_id);

-- ------------------------------------------------------------------------------
-- 3. Row Level Security & Permissions
-- ------------------------------------------------------------------------------
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Catalog is publicly readable for active items
DROP POLICY IF EXISTS "Public can view active badges" ON public.badges;
CREATE POLICY "Public can view active badges" ON public.badges
  FOR SELECT TO anon, authenticated, service_role
  USING (is_active = TRUE);

-- User badges are publicly readable for athlete showcase / profiles
DROP POLICY IF EXISTS "Public can view unlocked user badges" ON public.user_badges;
CREATE POLICY "Public can view unlocked user badges" ON public.user_badges
  FOR SELECT TO anon, authenticated, service_role
  USING (TRUE);

-- Direct client modifications are strictly blocked (no client INSERT/UPDATE/DELETE policies)
REVOKE INSERT, UPDATE, DELETE ON public.badges FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_badges FROM anon, authenticated;


-- ------------------------------------------------------------------------------
-- 4. Seed Initial 14 Badge Milestone Catalog
-- ------------------------------------------------------------------------------
INSERT INTO public.badges (id, title, description, category, tier, icon, criteria_type, criteria_threshold, xp_reward, is_active)
VALUES
  -- Practice Milestones
  ('first_solve', 'First Step', 'Solve your first practice problem correctly', 'practice', 'bronze', 'CheckCircle2', 'solved_count', 1, 0, true),
  ('practice_10', 'Sharpshooter', 'Solve 10 practice problems correctly', 'practice', 'bronze', 'Target', 'solved_count', 10, 0, true),
  ('practice_50', 'Problem Crusher', 'Solve 50 practice problems correctly', 'practice', 'silver', 'Zap', 'solved_count', 50, 0, true),
  ('practice_100', 'Centurion', 'Solve 100 practice problems correctly', 'practice', 'gold', 'Award', 'solved_count', 100, 0, true),

  -- Streak Milestones
  ('streak_3', 'Streak Spark', 'Maintain an active 3-day solving streak', 'streak', 'bronze', 'Flame', 'streak_days', 3, 0, true),
  ('streak_7', 'Streak Master', 'Maintain an active 7-day solving streak', 'streak', 'silver', 'Flame', 'streak_days', 7, 0, true),
  ('streak_30', 'Unstoppable', 'Maintain an active 30-day solving streak', 'streak', 'gold', 'Flame', 'streak_days', 30, 0, true),

  -- XP Milestones
  ('xp_100', 'Centurion XP', 'Earn 100 total unified XP', 'xp', 'bronze', 'Sparkles', 'total_xp', 100, 0, true),
  ('xp_500', 'XP Specialist', 'Earn 500 total unified XP', 'xp', 'silver', 'Sparkles', 'total_xp', 500, 0, true),
  ('xp_1000', 'Grand Competitor', 'Earn 1,000 total unified XP', 'xp', 'gold', 'Trophy', 'total_xp', 1000, 0, true),

  -- Accuracy Milestones (Minimum attempt threshold enforced server-side)
  ('accuracy_80', 'Accuracy Ace', 'Maintain at least 80% accuracy (min. 5 attempts)', 'accuracy', 'silver', 'Target', 'accuracy_percentage', 80, 0, true),
  ('accuracy_90', 'Precision Elite', 'Maintain at least 90% accuracy (min. 10 attempts)', 'accuracy', 'gold', 'CheckCircle2', 'accuracy_percentage', 90, 0, true),

  -- Contest Milestones
  ('contest_first', 'Arena Challenger', 'Complete your first official contest tournament', 'contest', 'bronze', 'Swords', 'contests_count', 1, 0, true),
  ('contest_5', 'Tournament Veteran', 'Complete 5 official contest tournaments', 'contest', 'silver', 'Trophy', 'contests_count', 5, 0, true)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  tier = EXCLUDED.tier,
  icon = EXCLUDED.icon,
  criteria_type = EXCLUDED.criteria_type,
  criteria_threshold = EXCLUDED.criteria_threshold,
  xp_reward = EXCLUDED.xp_reward,
  is_active = EXCLUDED.is_active;


-- ------------------------------------------------------------------------------
-- 5. RPC 1: evaluate_user_badges()
-- Evaluates authoritative DB metrics for caller auth.uid(), awards missing badges
-- Idempotent, safe, server-derived, locked search path.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_user_badges()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_solved_count INTEGER := 0;
  v_total_attempts INTEGER := 0;
  v_correct_attempts INTEGER := 0;
  v_accuracy NUMERIC := 0.0;
  v_streak INTEGER := 0;
  v_practice_xp BIGINT := 0;
  v_challenge_xp BIGINT := 0;
  v_contest_xp BIGINT := 0;
  v_total_xp BIGINT := 0;
  v_contests_count INTEGER := 0;
  v_newly_unlocked JSONB := '[]'::jsonb;
  v_total_unlocked INTEGER := 0;
BEGIN
  -- 1. Authoritative caller identification
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_AUTHENTICATED', 'message', 'Sign in required.');
  END IF;

  -- 2. Derive Practice Metrics from user_question_attempts
  SELECT 
    COALESCE(COUNT(DISTINCT question_id) FILTER (WHERE is_correct = TRUE), 0),
    COALESCE(COUNT(id), 0),
    COALESCE(COUNT(id) FILTER (WHERE is_correct = TRUE), 0),
    COALESCE(SUM(xp_change), 0)
  INTO 
    v_solved_count,
    v_total_attempts,
    v_correct_attempts,
    v_practice_xp
  FROM public.user_question_attempts
  WHERE user_id = v_user_id;

  IF v_total_attempts > 0 THEN
    v_accuracy := ROUND((v_correct_attempts::numeric / v_total_attempts::numeric) * 100.0, 1);
  ELSE
    v_accuracy := 0.0;
  END IF;

  -- 3. Derive Streak from user_streaks
  SELECT COALESCE(current_streak, 0)
  INTO v_streak
  FROM public.user_streaks
  WHERE user_id = v_user_id;

  -- 4. Derive Daily Challenge XP
  SELECT COALESCE(SUM(bonus_xp_awarded), 0)
  INTO v_challenge_xp
  FROM public.user_daily_challenge_completions
  WHERE user_id = v_user_id;

  -- 5. Derive Contest completions & XP
  SELECT 
    COALESCE(SUM(xp_awarded), 0),
    COALESCE(COUNT(id), 0)
  INTO 
    v_contest_xp,
    v_contests_count
  FROM public.contest_participants
  WHERE user_id = v_user_id AND status = 'completed';

  -- 6. Authoritative Unified XP
  v_total_xp := GREATEST(0::bigint, v_practice_xp + v_challenge_xp + v_contest_xp);

  -- 7. Identify eligible badges and insert missing rows
  WITH eligible_badges AS (
    SELECT b.id AS badge_id
    FROM public.badges b
    WHERE b.is_active = TRUE
      AND (
        (b.criteria_type = 'solved_count' AND v_solved_count >= b.criteria_threshold)
        OR (b.criteria_type = 'streak_days' AND v_streak >= b.criteria_threshold)
        OR (b.criteria_type = 'total_xp' AND v_total_xp >= b.criteria_threshold)
        OR (b.criteria_type = 'contests_count' AND v_contests_count >= b.criteria_threshold)
        OR (b.id = 'accuracy_80' AND v_total_attempts >= 5 AND v_accuracy >= 80)
        OR (b.id = 'accuracy_90' AND v_total_attempts >= 10 AND v_accuracy >= 90)
      )
  ),
  inserted AS (
    INSERT INTO public.user_badges (user_id, badge_id)
    SELECT v_user_id, eb.badge_id
    FROM eligible_badges eb
    ON CONFLICT (user_id, badge_id) DO NOTHING
    RETURNING badge_id
  )
  SELECT COALESCE(jsonb_agg(badge_id), '[]'::jsonb) INTO v_newly_unlocked
  FROM inserted;

  -- 8. Count total unlocked badges
  SELECT COUNT(*) INTO v_total_unlocked
  FROM public.user_badges
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'newly_unlocked', v_newly_unlocked,
    'newly_unlocked_count', jsonb_array_length(v_newly_unlocked),
    'total_unlocked', v_total_unlocked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_user_badges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_user_badges() TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. RPC 2: get_user_badges(p_user_id UUID)
-- Returns complete badge catalog with user's unlock state and clamped progress
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_badges(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_solved_count INTEGER := 0;
  v_total_attempts INTEGER := 0;
  v_correct_attempts INTEGER := 0;
  v_accuracy NUMERIC := 0.0;
  v_streak INTEGER := 0;
  v_practice_xp BIGINT := 0;
  v_challenge_xp BIGINT := 0;
  v_contest_xp BIGINT := 0;
  v_total_xp BIGINT := 0;
  v_contests_count INTEGER := 0;
  v_badges JSONB;
  v_unlocked_count INTEGER := 0;
  v_total_count INTEGER := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_ARGUMENT', 'message', 'User ID is required.');
  END IF;

  -- Verify user exists in profiles
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'USER_NOT_FOUND', 'message', 'User profile not found.');
  END IF;

  -- Derive Practice Metrics
  SELECT 
    COALESCE(COUNT(DISTINCT question_id) FILTER (WHERE is_correct = TRUE), 0),
    COALESCE(COUNT(id), 0),
    COALESCE(COUNT(id) FILTER (WHERE is_correct = TRUE), 0),
    COALESCE(SUM(xp_change), 0)
  INTO 
    v_solved_count,
    v_total_attempts,
    v_correct_attempts,
    v_practice_xp
  FROM public.user_question_attempts
  WHERE user_id = p_user_id;

  IF v_total_attempts > 0 THEN
    v_accuracy := ROUND((v_correct_attempts::numeric / v_total_attempts::numeric) * 100.0, 1);
  ELSE
    v_accuracy := 0.0;
  END IF;

  -- Derive Streak
  SELECT COALESCE(current_streak, 0)
  INTO v_streak
  FROM public.user_streaks
  WHERE user_id = p_user_id;

  -- Derive Daily Challenge XP
  SELECT COALESCE(SUM(bonus_xp_awarded), 0)
  INTO v_challenge_xp
  FROM public.user_daily_challenge_completions
  WHERE user_id = p_user_id;

  -- Derive Contest completions & XP
  SELECT 
    COALESCE(SUM(xp_awarded), 0),
    COALESCE(COUNT(id), 0)
  INTO 
    v_contest_xp,
    v_contests_count
  FROM public.contest_participants
  WHERE user_id = p_user_id AND status = 'completed';

  -- Authoritative Unified XP
  v_total_xp := GREATEST(0::bigint, v_practice_xp + v_challenge_xp + v_contest_xp);

  -- Count total active badges
  SELECT COUNT(*) INTO v_total_count FROM public.badges WHERE is_active = TRUE;

  -- Count unlocked for this user
  SELECT COUNT(*) INTO v_unlocked_count FROM public.user_badges WHERE user_id = p_user_id;

  -- Build badges array with calculated progress
  WITH badge_calculations AS (
    SELECT
      b.id,
      b.title,
      b.description,
      b.category,
      b.tier,
      b.icon,
      b.criteria_type,
      b.criteria_threshold,
      b.xp_reward,
      (ub.unlocked_at IS NOT NULL) AS is_unlocked,
      ub.unlocked_at,
      CASE
        WHEN ub.unlocked_at IS NOT NULL THEN b.criteria_threshold
        WHEN b.criteria_type = 'solved_count' THEN v_solved_count
        WHEN b.criteria_type = 'streak_days' THEN v_streak
        WHEN b.criteria_type = 'total_xp' THEN v_total_xp
        WHEN b.criteria_type = 'contests_count' THEN v_contests_count
        WHEN b.criteria_type = 'accuracy_percentage' THEN v_accuracy
        ELSE 0
      END AS current_progress,
      CASE
        WHEN ub.unlocked_at IS NOT NULL THEN 100.0
        WHEN b.id = 'accuracy_80' THEN
          CASE 
            WHEN v_total_attempts < 5 THEN ROUND((v_total_attempts::numeric / 5.0) * 50.0, 1)
            ELSE LEAST(100.0, GREATEST(0.0, ROUND((v_accuracy / 80.0) * 100.0, 1)))
          END
        WHEN b.id = 'accuracy_90' THEN
          CASE 
            WHEN v_total_attempts < 10 THEN ROUND((v_total_attempts::numeric / 10.0) * 50.0, 1)
            ELSE LEAST(100.0, GREATEST(0.0, ROUND((v_accuracy / 90.0) * 100.0, 1)))
          END
        WHEN b.criteria_threshold > 0 THEN
          CASE 
            WHEN b.criteria_type = 'solved_count' THEN LEAST(100.0, GREATEST(0.0, ROUND((v_solved_count::numeric / b.criteria_threshold) * 100.0, 1)))
            WHEN b.criteria_type = 'streak_days' THEN LEAST(100.0, GREATEST(0.0, ROUND((v_streak::numeric / b.criteria_threshold) * 100.0, 1)))
            WHEN b.criteria_type = 'total_xp' THEN LEAST(100.0, GREATEST(0.0, ROUND((v_total_xp::numeric / b.criteria_threshold) * 100.0, 1)))
            WHEN b.criteria_type = 'contests_count' THEN LEAST(100.0, GREATEST(0.0, ROUND((v_contests_count::numeric / b.criteria_threshold) * 100.0, 1)))
            ELSE 0.0
          END
        ELSE 0.0
      END AS progress_percentage
    FROM public.badges b
    LEFT JOIN public.user_badges ub ON ub.badge_id = b.id AND ub.user_id = p_user_id
    WHERE b.is_active = TRUE
    ORDER BY 
      (ub.unlocked_at IS NOT NULL) DESC,
      CASE b.tier WHEN 'platinum' THEN 1 WHEN 'gold' THEN 2 WHEN 'silver' THEN 3 ELSE 4 END ASC,
      b.criteria_threshold ASC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', bc.id,
      'title', bc.title,
      'description', bc.description,
      'category', bc.category,
      'tier', bc.tier,
      'icon', bc.icon,
      'criteria_type', bc.criteria_type,
      'criteria_threshold', bc.criteria_threshold,
      'xp_reward', bc.xp_reward,
      'is_unlocked', bc.is_unlocked,
      'unlocked_at', bc.unlocked_at,
      'current_progress', bc.current_progress,
      'progress_percentage', bc.progress_percentage
    )
  ) INTO v_badges
  FROM badge_calculations bc;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'unlocked_count', v_unlocked_count,
    'total_count', v_total_count,
    'badges', COALESCE(v_badges, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_badges(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_badges(UUID) TO anon, authenticated, service_role;
