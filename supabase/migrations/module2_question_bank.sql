-- =======================================================
-- MODULE 2: QUESTION BANK & USER PROGRESS TRACKING
-- =======================================================

-- 1. Create table for User Question Progress & Bookmarks
CREATE TABLE IF NOT EXISTS public.user_question_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT NOT NULL,
  selected_option TEXT,
  is_solved BOOLEAN DEFAULT FALSE NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE NOT NULL,
  is_bookmarked BOOLEAN DEFAULT FALSE NOT NULL,
  attempts_count INT DEFAULT 1 NOT NULL,
  time_spent_seconds INT DEFAULT 0 NOT NULL,
  last_attempted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, question_id)
);

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_question_progress_user ON public.user_question_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_question_progress_bookmarked ON public.user_question_progress(user_id, is_bookmarked);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_question_progress ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Users can read, insert, update, and delete their own progress only
DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_question_progress;
CREATE POLICY "Users can view their own progress"
  ON public.user_question_progress FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own progress" ON public.user_question_progress;
CREATE POLICY "Users can insert their own progress"
  ON public.user_question_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own progress" ON public.user_question_progress;
CREATE POLICY "Users can update their own progress"
  ON public.user_question_progress FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own progress" ON public.user_question_progress;
CREATE POLICY "Users can delete their own progress"
  ON public.user_question_progress FOR DELETE
  USING (auth.uid() = user_id);
