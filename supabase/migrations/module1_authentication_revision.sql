-- ==============================================================================
-- MODULE 1: AUTHENTICATION & IDENTITY REVISION
-- Canonical Username Rules, DB-Level Uniqueness, RLS, Cleanup, and Auth Security
-- ==============================================================================

-- 1. Ensure profiles table exists
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  username_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure bio, username_changed_at, and avatar_url columns exist if table already existed
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN bio TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username_changed_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username_changed_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT DEFAULT NULL;
  END IF;
END $$;

-- 3. Case-Insensitive Unique Index on Username
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower 
ON public.profiles (LOWER(TRIM(username)))
WHERE username IS NOT NULL;

-- 4. Enforce Canonical Username Constraints in PostgreSQL
-- - 3 to 20 characters
-- - only lowercase letters, digits, '.', '_', '-'
-- - cannot start or end with '.', '_', '-'
-- - no consecutive separators
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_canonical_username;
  ALTER TABLE public.profiles ADD CONSTRAINT chk_canonical_username
    CHECK (
      username IS NULL OR (
        length(username) >= 3 AND
        length(username) <= 20 AND
        username ~ '^[a-z0-9][a-z0-9_.-]*[a-z0-9]$' AND
        username !~ '[._-]{2,}'
      )
    );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Constraint chk_canonical_username could not be applied or already exists: %', SQLERRM;
END $$;

-- 5. Enable Row Level Security (RLS) on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 6. Helper Function: Fail-Closed Permanent User Check
-- Evaluates to true ONLY when is_anonymous is explicitly present in JWT and false.
CREATE OR REPLACE FUNCTION public.is_permanent_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT 
    auth.jwt() IS NOT NULL AND
    (auth.jwt()->>'is_anonymous') IS NOT NULL AND
    (auth.jwt()->>'is_anonymous')::boolean = false;
$$;

REVOKE ALL ON FUNCTION public.is_permanent_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_permanent_user() TO anon, authenticated, service_role;

-- 7. RLS Policies on profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 8. Hardened Server-Side Cleanup for Abandoned Anonymous Accounts (24-Hour Retention)
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_anonymous_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted_rows AS (
    DELETE FROM auth.users
    WHERE is_anonymous = true
      AND created_at < NOW() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT count(*) INTO deleted_count FROM deleted_rows;
  
  RETURN deleted_count;
END;
$$;

-- Revoke all client execution permissions
REVOKE ALL ON FUNCTION public.cleanup_abandoned_anonymous_users() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_abandoned_anonymous_users() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_abandoned_anonymous_users() FROM authenticated;

-- Grant execution only to internal superuser / service role for scheduler
GRANT EXECUTE ON FUNCTION public.cleanup_abandoned_anonymous_users() TO service_role, postgres;

-- 9. REMOVE INSECURE RPC
DROP FUNCTION IF EXISTS public.resolve_username_to_email(TEXT);
DROP FUNCTION IF EXISTS public.resolve_username_to_email;

-- 10. Auto-create Profile Trigger upon auth.users signup (for OAuth & programmatic creation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
BEGIN
  v_username := lower(trim(NEW.raw_user_meta_data->>'username'));
  v_display_name := NEW.raw_user_meta_data->>'display_name';

  IF v_display_name IS NULL OR trim(v_display_name) = '' THEN
    v_display_name := v_username;
  END IF;

  IF v_username IS NOT NULL AND v_username <> '' THEN
    INSERT INTO public.profiles (id, username, display_name, created_at, updated_at)
    VALUES (NEW.id, v_username, v_display_name, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        display_name = COALESCE(profiles.display_name, EXCLUDED.display_name),
        updated_at = NOW()
    WHERE profiles.username IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
