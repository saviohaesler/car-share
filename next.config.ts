import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // The key must be at the top level, NOT under experimental
  allowedDevOrigins: ['192.168.1.167', 'localhost:3000'],
};

export default nextConfig;