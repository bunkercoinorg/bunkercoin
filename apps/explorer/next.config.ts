import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  output: 'export',
  transpilePackages: ['@bunkercoin/ui', '@bunkercoin/chain-format'],
};

export default nextConfig;
