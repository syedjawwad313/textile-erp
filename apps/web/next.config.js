/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Render deployment — outputs a standalone build
  output: 'standalone',

  // Allow the API URL to be injected at build time
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },

  // Disable eslint and TypeScript errors blocking production build on CI
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
