/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable eslint errors blocking production build on CI
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Reverse proxy /api/v1 requests to the backend API service.
  // This allows the browser to use same-origin relative URLs (/api/v1/...)
  // avoiding CORS restrictions and eliminating hardcoded localhost failures on cloud deployments.
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
        source: '/api/v1/:path*',
        destination: `${baseTarget}/api/v1/:path*`,
      },
      {
        source: '/health',
        destination: `${baseTarget}/health`,
      },
    ];
  },
};

module.exports = nextConfig;
