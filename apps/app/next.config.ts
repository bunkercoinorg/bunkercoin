import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
 
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
 
export default async function config(phase: string): Promise<NextConfig> {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const { initOpenNextCloudflareForDev } = await import("@opennextjs/cloudflare");
    initOpenNextCloudflareForDev();
  }
  return nextConfig;
}