// Supabase client factory.
// This lets the rest of Apticks communicate with our
// Supabase database and authentication system.

import { createClient } from '@supabase/supabase-js'


// Vite exposes only variables prefixed with VITE_
// to frontend code.
const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://zglujtystsnqyouroxbq.supabase.co'

const supabasePublishableKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  'sb_publishable_KbBJDqazSl8vPdaJjl0HLw_JqCEZR-k'

// Fail early if the environment variables are missing.
// This makes configuration errors much easier to debug.
if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing Supabase environment variables. Check your .env.local file.',
  )
}


// Create one reusable Supabase client for the entire app.
//
// We will use this client for:
// - Authentication
// - Database queries
// - User profiles
// - Storage
// - Realtime features
export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
)