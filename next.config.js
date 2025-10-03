/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for better performance
  experimental: {
    // Enable server components logging in development
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },
  
  // Environment-specific configuration
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Image optimization
  images: {
    domains: ['localhost', 'yourdomain.com'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // Redirects for production
  async redirects() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/',
          destination: '/dashboard',
          permanent: false,
        },
      ];
    }
    return [];
  },
  
  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add any custom webpack configuration here
    return config;
  },
};

module.exports = nextConfig;
