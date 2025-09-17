import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Do not block production builds on ESLint warnings
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
