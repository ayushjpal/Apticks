-- ==============================================================================
-- MIGRATION: REMOVE_BADGES_SYSTEM.sql (REVIEW ONLY - DO NOT AUTO-EXECUTE)
-- ==============================================================================
-- Description:
--   Permanently removes the isolated Badge and Achievement gamification tables,
--   indices, policies, and RPC functions from Supabase.
--
-- Dependency Audit Summary:
--   - Foreign Keys:
--       * public.user_badges(badge_id) -> public.badges(id)
--       * public.user_badges(user_id)  -> auth.users(id)
--       * No other tables in the Apticks schema reference public.badges or public.user_badges.
--   - Triggers: None. (Badge awarding was executed exclusively via on-demand RPC).
--   - Policies:
--       * Public can view active badges on public.badges
--       * Public can view unlocked user badges on public.user_badges
--   - RPC Functions:
--       * public.evaluate_user_badges()
--       * public.get_user_badges(p_user_id UUID)
--   - Edge Functions: None. Verified zero references in supabase/functions/.
--   - Non-Destructive Impact:
--       * Does NOT affect auth, profiles, XP formulas, levelEngine, user_streaks,
--         daily_challenges, questions, question_attempts, or contests.
-- ==============================================================================

-- Step 1: Revoke permissions and drop RPC functions
REVOKE ALL ON FUNCTION public.evaluate_user_badges() FROM authenticated, service_role, PUBLIC;
DROP FUNCTION IF EXISTS public.evaluate_user_badges();

REVOKE ALL ON FUNCTION public.get_user_badges(UUID) FROM anon, authenticated, service_role, PUBLIC;
DROP FUNCTION IF EXISTS public.get_user_badges(UUID);

-- Step 2: Drop Row Level Security policies explicitly
DROP POLICY IF EXISTS "Public can view unlocked user badges" ON public.user_badges;
DROP POLICY IF EXISTS "Public can view active badges" ON public.badges;

-- Step 3: Drop indices explicitly
DROP INDEX IF EXISTS public.idx_user_badges_user_id;
DROP INDEX IF EXISTS public.idx_user_badges_badge_id;

-- Step 4: Drop user ownership ledger table first (depends on public.badges)
DROP TABLE IF EXISTS public.user_badges;

-- Step 5: Drop active catalog table
DROP TABLE IF EXISTS public.badges;
