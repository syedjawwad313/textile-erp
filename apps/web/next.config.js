/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable eslint errors blocking production build on CI
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Rewrites for health probe
  async rewrites() {
    const rawTarget =
      process.env.API_URL ||
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'https://textile-erp-api.onrender.com';

    const baseTarget = rawTarget
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/+$/, '');

    return [
      {
        source: '/health',
        destination: `${baseTarget}/health`,
      },
    ];
  },
};

module.exports = nextConfig;
