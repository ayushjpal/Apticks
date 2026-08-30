-- ==============================================================================
-- MODULE 2.1: QUESTION ATTEMPT HISTORY & COMPETITIVE XP ENGINE
-- Immutable attempt tracking, negative marking, and user-scoped RLS policies
-- ==============================================================================

-- 1. Create table for detailed attempt history
CREATE TABLE IF NOT EXISTS public.user_question_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id TEXT REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  selected_option TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  xp_change INTEGER NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_user_question_attempts_user ON public.user_question_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_question_attempts_question ON public.user_question_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_user_question_attempts_user_question ON public.user_question_attempts(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_user_question_attempts_created_at ON public.user_question_attempts(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_question_attempts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Users can view and insert their own attempts only
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.user_question_attempts;
CREATE POLICY "Users can view their own attempts"
  ON public.user_question_attempts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own attempts" ON public.user_question_attempts;
CREATE POLICY "Users can insert their own attempts"
  ON public.user_question_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: Attempts are immutable history records. Updates are disallowed by design.
