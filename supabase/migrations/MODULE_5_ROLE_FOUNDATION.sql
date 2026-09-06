-- ==============================================================================
-- MODULE 5: ADMIN & MODERATOR CONTROL CENTER
-- STEP 1: ROLE FOUNDATION & SECURE AUTHORIZATION MIGRATION
-- ==============================================================================
-- Roles supported: 'user', 'moderator', 'admin'
-- Security Principles:
--   1. Role is strictly persisted and enforced database-side in public.profiles.
--   2. Default role for all users is 'user'.
--   3. Authenticated clients CANNOT alter their own or any other user's role via direct table updates.
--   4. Role alterations trigger fail-closed security: requires active Admin role or superuser/service_role.
--   5. Initial Admin account bootstrap is performed via a dedicated, self-locking one-time function
--      executable exclusively by the database owner (postgres) or service_role.
--   6. Post-bootstrap role management is conducted via public.admin_set_user_role().
--   7. Helper functions is_admin() and is_moderator_or_admin() provide fast, non-recursive RLS building blocks.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA: Add role column to public.profiles
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
  END IF;
END $$;

-- Enforce valid roles constraint
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_profiles_role;
  ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_role
    CHECK (role IN ('user', 'moderator', 'admin'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint chk_profiles_role check: %', SQLERRM;
END $$;

-- Create index for high-performance role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);


-- ------------------------------------------------------------------------------
-- 2. TRIGGER: Fail-Closed Role Protection Trigger
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_profile_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_is_admin BOOLEAN;
BEGIN
  -- Determine caller database role
  v_caller_role := current_user;

  -- 1. INSERT Operations
  IF TG_OP = 'INSERT' THEN
    -- If created directly by database superuser or service_role, preserve specified role
    IF v_caller_role IN ('postgres', 'service_role') THEN
      NEW.role := COALESCE(NEW.role, 'user');
      RETURN NEW;
    END IF;

    -- Any client request (authenticated or anon) is ALWAYS forced to 'user'
    NEW.role := 'user';
    RETURN NEW;
  END IF;

  -- 2. UPDATE Operations
  IF TG_OP = 'UPDATE' THEN
    -- If role is NOT being changed, allow standard profile edits (bio, display_name, avatar, etc.)
    IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
      RETURN NEW;
    END IF;

    -- Role IS being changed: strictly verify caller context
    
    -- Context 1: Database owner / superuser in SQL Editor
    IF v_caller_role = 'postgres' THEN
      RETURN NEW;
    END IF;

    -- Context 2: Service-role backend process
    IF v_caller_role = 'service_role' OR (auth.jwt() ->> 'role') = 'service_role' THEN
      RETURN NEW;
    END IF;

    -- Context 3: Authenticated client request — must be an active platform Admin
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_is_admin IS TRUE THEN
      RETURN NEW;
    END IF;

    -- Fail-closed rejection for normal users, moderators, and unauthenticated callers
    RAISE EXCEPTION 'Access denied: insufficient permissions to modify user roles.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_role_update();


-- ------------------------------------------------------------------------------
-- 3. INITIAL ADMIN BOOTSTRAP: Dedicated, Self-Locking Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bootstrap_initial_admin(p_target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_admin_count INTEGER;
  v_target_exists BOOLEAN;
  v_target_username TEXT;
BEGIN
  -- 1. Self-Locking Check: Allowed ONLY when zero admins exist on the platform
  SELECT count(*) INTO v_existing_admin_count
  FROM public.profiles
  WHERE role = 'admin';

  IF v_existing_admin_count > 0 THEN
    RAISE EXCEPTION 'Bootstrap locked: An administrator already exists (count: %). Use admin_set_user_role() for subsequent role management.', v_existing_admin_count;
  END IF;

  -- 2. Verify target user exists
  SELECT true, username INTO v_target_exists, v_target_username
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF v_target_exists IS NOT TRUE THEN
    RAISE EXCEPTION 'Bootstrap failed: Target user with ID % does not exist in public.profiles.', p_target_user_id;
  END IF;

  -- 3. Execute promotion
  UPDATE public.profiles
  SET role = 'admin', updated_at = NOW()
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Initial administrator successfully bootstrapped.',
    'user_id', p_target_user_id,
    'username', v_target_username,
    'role', 'admin',
    'timestamp', NOW()
  );
END;
$$;

-- Revoke all client execution permissions
REVOKE ALL ON FUNCTION public.bootstrap_initial_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_initial_admin(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.bootstrap_initial_admin(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_initial_admin(UUID) TO postgres, service_role;


-- ------------------------------------------------------------------------------
-- 4. AUTHORIZATION HELPERS: Fast, Non-Recursive Functions
-- ------------------------------------------------------------------------------
-- A. Get calling user's current role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'user'
  );
$$;

-- B. Check if calling user is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- C. Check if calling user is Moderator OR Admin (Staff)
CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('moderator', 'admin')
  );
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_moderator_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_moderator_or_admin() TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. ROLE MANAGEMENT RPC: admin_set_user_role
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_target_user_id UUID,
  p_new_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_is_admin BOOLEAN;
  v_caller_id UUID;
  v_target_exists BOOLEAN;
  v_current_admin_count INTEGER;
BEGIN
  v_caller_id := auth.uid();

  -- 1. Authorization check
  IF (current_user = 'service_role' OR (auth.jwt() ->> 'role') = 'service_role') THEN
    v_caller_is_admin := TRUE;
  ELSE
    SELECT (role = 'admin') INTO v_caller_is_admin
    FROM public.profiles
    WHERE id = v_caller_id;
  END IF;

  IF v_caller_is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED',
      'message', 'Only administrators are authorized to manage user roles.'
    );
  END IF;

  -- 2. Validate role value
  IF p_new_role NOT IN ('user', 'moderator', 'admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_ROLE',
      'message', 'Role must be one of: user, moderator, admin.'
    );
  END IF;

  -- 3. Verify target user exists
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_target_user_id
  ) INTO v_target_exists;

  IF NOT v_target_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'USER_NOT_FOUND',
      'message', 'Target user profile not found.'
    );
  END IF;

  -- 4. Protection against last-admin self-demotion
  IF v_caller_id = p_target_user_id AND p_new_role != 'admin' THEN
    SELECT count(*) INTO v_current_admin_count
    FROM public.profiles
    WHERE role = 'admin';

    IF v_current_admin_count <= 1 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'SOLE_ADMIN_DEMOTION_FORBIDDEN',
        'message', 'Cannot demote the sole administrator of the platform.'
      );
    END IF;
  END IF;

  -- 5. Execute role update
  UPDATE public.profiles
  SET role = p_new_role,
      updated_at = NOW()
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'new_role', p_new_role,
    'updated_by', v_caller_id,
    'timestamp', NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated, service_role;
