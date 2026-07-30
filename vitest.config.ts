import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest — unit + integration test runner for the backend foundation.
 * `tests/unit` mirrors `src/server` 1:1; `tests/integration` exercises
 * route handlers end-to-end against test doubles (no live Postgres/Redis
 * required — see tests/helpers/README.md for the test-double strategy).
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Two test locations by convention: tests/ for cross-cutting
    // server/* infra, and a co-located tests/ folder inside each
    // src/modules/<domain> for that module's own unit tests.
    include: ["tests/**/*.test.ts", "src/modules/**/tests/**/*.test.ts"],
    // Non-secret placeholders so src/server/config/env.ts's Zod validation
    // passes when a test imports something that pulls in `env`. Real
    // Postgres/Redis are never contacted by the unit suite — see
    // tests/helpers/README.md for why (interfaces + in-memory fakes).
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      AUTH_SECRET: "test-secret",
      JWT_ACCESS_SECRET: "test-access-secret",
      JWT_REFRESH_SECRET: "test-refresh-secret",
      UPLOADS_LOCAL_DIR: "./.vitest-uploads",
      ENCRYPTION_KEY: "YIYRszgvSkBjSfSIPVwfzlfeVSHw7ZThUrurfFCLupw=",
      VAPID_PUBLIC_KEY: "test-vapid-public-key",
      VAPID_PRIVATE_KEY: "test-vapid-private-key",
      VAPID_SUBJECT: "mailto:test@example.com",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/server/**/*.ts"],
      exclude: ["src/server/**/*.d.ts", "src/server/**/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
