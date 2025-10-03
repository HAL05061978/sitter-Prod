import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey, appEnv, isDevelopment, isProduction } from './env-validation';

// Create a single Supabase client instance to prevent multiple GoTrueClient warnings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  // Environment-specific configuration
  global: {
    headers: {
      'X-Client-Info': `sitter-app-${appEnv}`,
    },
  },
  // Debug logging disabled for cleaner development console
  // ...(isDevelopment && {
  //   auth: {
  //     persistSession: true,
  //     autoRefreshToken: true,
  //     detectSessionInUrl: true,
  //     debug: true,
  //   },
  // }),
});

// Export environment info for debugging
export const environment = {
  env: appEnv,
  supabaseUrl,
  isDevelopment,
  isProduction,
};
