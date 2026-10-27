import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The e2e run starts a second dev server (broken API URL); it needs its own build dir.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
