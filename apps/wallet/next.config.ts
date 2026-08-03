import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  // Builds use their own dir so `next build` can never corrupt a running dev server.
  distDir: process.env.NEXT_BUILD_DIR || '.next',
};

export default nextConfig;
