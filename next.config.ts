import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Muss auf oberster Ebene stehen, NICHT unter experimental
  allowedDevOrigins: ['192.168.1.167', 'localhost:3000'],

  // Konservative Security-Header (kein Einbetten in fremde Seiten,
  // kein MIME-Sniffing, keine Referrer-Leaks an fremde Origins)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
