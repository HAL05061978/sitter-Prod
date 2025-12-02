/**
 * Environment Configuration Utility
 * Centralized environment variable management for different environments
 */

export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  APP_ENV: 'development' | 'qa' | 'production';
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  APP_URL: string;
  DEBUG: boolean;
}

/**
 * Get environment configuration based on current environment
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || 'development') as 'development' | 'qa' | 'production';
  
  // Base configuration
  const config: EnvironmentConfig = {
    NODE_ENV: nodeEnv,
    APP_ENV: appEnv,
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    DEBUG: process.env.NEXT_PUBLIC_DEBUG === 'true',
  };

  // Environment-specific overrides
  switch (appEnv) {
    case 'development':
      return {
        ...config,
        APP_URL: 'http://localhost:3000',
        DEBUG: true,
      };
    
    case 'qa':
      return {
        ...config,
        APP_URL: 'http://localhost:3001',
        DEBUG: true,
      };
    
    case 'production':
      return {
        ...config,
        APP_URL: 'https://care-n-care.vercel.app',
        DEBUG: false,
      };
    
    default:
      return config;
  }
}

/**
 * Validate required environment variables
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): void {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !config[key as keyof EnvironmentConfig]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env.${config.APP_ENV} file.`
    );
  }
}

/**
 * Get current environment info for debugging
 */
export function getEnvironmentInfo() {
  const config = getEnvironmentConfig();
  return {
    nodeEnv: config.NODE_ENV,
    appEnv: config.APP_ENV,
    appUrl: config.APP_URL,
    debug: config.DEBUG,
    supabaseUrl: config.SUPABASE_URL ? '✅ Set' : '❌ Missing',
    supabaseKey: config.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
  };
}


