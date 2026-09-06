-- ==============================================================================
-- MODULE 5 — STEP 4: ROLE PROTECTION & SECURITY HARDENING
-- ==============================================================================
-- Purpose:
-- 1. Fix trigger security context in `check_profile_role_update()`.
--    Inside SECURITY DEFINER functions in PostgreSQL, `current_user` evaluates to
--    the function owner ('postgres'), not the caller. Relying on `current_user = 'postgres'`
--    in a SECURITY DEFINER trigger inadvertently permitted direct client updates.
--    This migration updates the trigger to check `session_user = 'postgres'` (SQL Editor)
--    and enforce that all authenticated PostgREST client updates to `profiles.role`
--    strictly require `is_admin() = true`.
-- 2. Add defense-in-depth sole-admin self-demotion prevention inside the trigger.
-- 3. Preserve complete backwards compatibility with Modules 1, 2, 3, 4 and Step 1-3.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_current_admin_count INTEGER;
BEGIN
  -- 1. INSERT Operations
  IF TG_OP = 'INSERT' THEN
    -- If created directly by database superuser in SQL Editor (not via PostgREST):
    IF session_user = 'postgres' AND auth.role() IS NULL THEN
      NEW.role := COALESCE(NEW.role, 'user');
      RETURN NEW;
    END IF;

    -- If created by service_role backend process:
    IF (auth.jwt() ->> 'role') = 'service_role' OR auth.role() = 'service_role' THEN
      NEW.role := COALESCE(NEW.role, 'user');
      RETURN NEW;
    END IF;

    -- Any web client request (authenticated or anon) is ALWAYS forced to 'user'
    NEW.role := 'user';
    RETURN NEW;
  END IF;

  -- 2. UPDATE Operations
  IF TG_OP = 'UPDATE' THEN
    -- If role is NOT being changed, allow standard profile edits (bio, display_name, avatar, etc.)
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
      RETURN NEW;
    END IF;

    -- Role IS being changed: strictly verify caller authorization context

    -- Context 1: Database owner / superuser running directly in Supabase SQL Editor
    IF session_user = 'postgres' AND auth.role() IS NULL THEN
      RETURN NEW;
    END IF;

    -- Context 2: Service-role backend process
    IF (auth.jwt() ->> 'role') = 'service_role' OR auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;

    -- Context 3: Authenticated client request via PostgREST — must be an active platform Admin
    IF auth.uid() IS NOT NULL THEN
      SELECT (role = 'admin') INTO v_is_admin
      FROM public.profiles
      WHERE id = auth.uid();

      IF v_is_admin IS TRUE THEN
        -- Sole-admin protection: cannot demote self if only 1 admin remains
        IF OLD.role = 'admin' AND NEW.role != 'admin' AND OLD.id = auth.uid() THEN
          SELECT count(*) INTO v_current_admin_count
          FROM public.profiles
          WHERE role = 'admin';

          IF v_current_admin_count <= 1 THEN
            RAISE EXCEPTION 'Access denied: cannot demote the sole administrator of the platform.';
          END IF;
        END IF;

        RETURN NEW;
      END IF;
    END IF;

    -- Fail-closed rejection for normal users, moderators, and unauthenticated callers
    RAISE EXCEPTION 'Access denied: insufficient permissions to modify user roles.';
  END IF;

  RETURN NEW;
END;
$$;

-- Re-bind trigger to ensure freshest function reference
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_role_update();
