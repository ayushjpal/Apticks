-- ==============================================================================
-- APTIVERSE: PROFILE ENHANCEMENTS (BIO, PFP, 14-DAY USERNAME COOLDOWN)
-- ==============================================================================

-- 1. Safely add columns to profiles table if they don't already exist
DO $$ 
BEGIN
  -- Add bio column (max 160 chars)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN bio text DEFAULT NULL;
  END IF;

  -- Add username_changed_at column for 14-day Instagram-style rate limiting
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'username_changed_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username_changed_at timestamptz DEFAULT NULL;
  END IF;

  -- Ensure avatar_url column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url text DEFAULT NULL;
  END IF;
END $$;

-- 2. Create Storage Bucket for avatars if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies for Avatars
DO $$
BEGIN
  -- Allow public to read avatar images
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public read avatars'
  ) THEN
    CREATE POLICY "Public read avatars"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'avatars');
  END IF;

  -- Allow authenticated users to upload their own avatar
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload avatars'
  ) THEN
    CREATE POLICY "Authenticated users can upload avatars"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;

  -- Allow authenticated users to update/replace their own avatar
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can update their avatars'
  ) THEN
    CREATE POLICY "Authenticated users can update their avatars"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
END $$;
