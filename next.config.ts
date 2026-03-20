import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Der Key muss auf der obersten Ebene stehen, NICHT unter experimental
  allowedDevOrigins: ['192.168.1.167', 'localhost:3000'],
};

export default nextConfig;