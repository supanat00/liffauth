import type { NextConfig } from 'next';

/** @type {import('next').NextConfig} */

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Disables ESLint errors during `next build`
  },
  distDir: 'out',   // Stores static files in 'out' directory
  output: 'export', // This enables static export
  images: {
    unoptimized: true,  // Disables image optimization for static export
  },
  reactStrictMode: true,  // Enables React strict mode
  /* config options here */
};

module.exports = nextConfig;
