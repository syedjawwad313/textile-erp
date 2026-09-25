/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable lint and typescript errors from blocking production build
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
