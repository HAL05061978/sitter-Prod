import { createClient } from '@supabase/supabase-js';

// Create a single Supabase client instance to prevent multiple GoTrueClient warnings
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);
