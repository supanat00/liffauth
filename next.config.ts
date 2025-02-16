import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Disables ESLint errors during `next build`
  },
  output: "export", // Enables static export
  distDir: "out",   // Stores static files in "out" directory
  images: {
    unoptimized: true,  // Disables image optimization for static export
  }
  /* config options here */
};

export default nextConfig;
