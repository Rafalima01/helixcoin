import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for the multi-stage Docker build (Dockerfile) — bundles
  // only the production dependency graph the server actually needs.
  output: "standalone",

  // Fase 9: admin./manager./api. are separate dev origins from the default
  // `localhost`. Without this, Next's dev-only cross-origin guard blocks
  // direct requests to dev assets/HMR/RSC from those hosts (see
  // node_modules/next/dist/docs/.../allowedDevOrigins.md). Dev-only —
  // production subdomains are real DNS names, not same-machine origins.
  allowedDevOrigins: [
    "player.localhost",
    "admin.localhost",
    "manager.localhost",
    "api.localhost",
    "player.localhost:3000",
    "admin.localhost:3000",
    "manager.localhost:3000",
    "api.localhost:3000",
  ],

  // Baseline hardening headers, identical for all 4 zones (player/admin/
  // manager/api) — CORS/rate limiting live in src/server/security and
  // src/proxy.ts, this is the static layer applied to every response
  // regardless of route or host.
  //
  // CSP is deliberately conservative rather than nonce-based: this app has
  // zero third-party script/style/font/image origins (next/font self-hosts
  // fonts at build time, Swagger UI is vendored under public/swagger-ui,
  // Rapier's WASM is bundled as a same-origin static asset) — everything
  // resolves to 'self'. `'unsafe-inline'` on script/style is needed for
  // Next's hydration bootstrap script and Tailwind/framer-motion's inline
  // styles; `'wasm-unsafe-eval'` is needed for the physics engine
  // (@react-three/rapier) to compile WebAssembly. `frame-ancestors: 'none'`
  // is the CSP-level equivalent of the `X-Frame-Options: DENY` below (kept
  // for older browsers that don't support frame-ancestors).
  //
  // `'unsafe-eval'` is added to script-src ONLY in dev — Turbopack's HMR and
  // React's dev-mode callstack reconstruction both call plain `eval()`
  // (confirmed via a real console error without this: "eval() is not
  // supported in this environment... React will never use eval() in
  // production mode"). Production never needs it and stays without it.
  async headers() {
    const scriptSrc =
      process.env.NODE_ENV === "development"
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'"
        : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'";

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
