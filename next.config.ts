import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the multi-stage Docker build (Dockerfile) — bundles
  // only the production dependency graph the server actually needs.
  output: "standalone",

  // Baseline hardening headers. CSP/CORS/rate limiting live in
  // src/server/security and src/proxy.ts — this is the static layer that
  // applies to every response regardless of route.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
