import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // PSX Personal Assistant: the in-app mic needs microphone access on this page only.
        source: "/personal-assistant.html",
        headers: [{ key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" }],
      },
      {
        source: "/personal",
        headers: [{ key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" }],
      },
    ];
  },
  async rewrites() {
    return [{ source: "/personal", destination: "/personal-assistant.html" }];
  },
};

export default nextConfig;
