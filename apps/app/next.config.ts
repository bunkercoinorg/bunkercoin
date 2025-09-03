import type { NextConfig } from "next";
 
const nextConfig: NextConfig = {
  // other config options...
  webpack(config, { isServer }) {
    if (!isServer) {
      if (!config.resolve) config.resolve = { fallback: {} } as any;
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        crypto: false,
        stream: false,
        fs: false,
        path: false,
      } as Record<string, false>;
    }
    return config;
  },
};
 
export default nextConfig;
 
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();