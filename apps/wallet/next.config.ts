import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';
import type { NextConfig } from 'next';

// With output: 'export' a custom distDir becomes the export target, so builds keep the default
// (.next, exported to out/) and only the dev server moves aside so the two never share a directory.
export default function config(phase: string): NextConfig {
  return {
    output: 'export',
    ...(phase === PHASE_DEVELOPMENT_SERVER ? { distDir: '.next-dev' } : {}),
  };
}
