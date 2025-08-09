/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Only run type-checking in production build
    ignoreBuildErrors: false,
  },
  eslint: {
    // Only run ESLint in production build
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
