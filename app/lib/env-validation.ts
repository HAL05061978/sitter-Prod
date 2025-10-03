/**
 * Environment validation utility
 * Ensures all required environment variables are present
 */

interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appEnv: string;
  appUrl: string;
  nodeEnv: string;
}

function validateEnvironment(): EnvironmentConfig {
  const requiredVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  return {
    supabaseUrl: requiredVars.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: requiredVars.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    appEnv: requiredVars.NEXT_PUBLIC_APP_ENV!,
    appUrl: requiredVars.NEXT_PUBLIC_APP_URL!,
    nodeEnv: requiredVars.NODE_ENV!,
  };
}

// Validate environment on module load
export const env = validateEnvironment();

// Export individual values for convenience
export const {
  supabaseUrl,
  supabaseAnonKey,
  appEnv,
  appUrl,
  nodeEnv,
} = env;

// Environment checks
export const isDevelopment = appEnv === 'development';
export const isProduction = appEnv === 'production';
export const isTest = appEnv === 'test';

// Log environment info in development
if (isDevelopment) {
  console.log('🔧 Environment Configuration:', {
    env: appEnv,
    supabaseUrl: supabaseUrl.replace(/\/\/.*@/, '//***@'), // Hide credentials
    appUrl,
    nodeEnv,
  });
}
