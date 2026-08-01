import { z } from "zod";

/**
 * The single source of truth for every environment variable the backend
 * reads. Nothing in src/server (or any route handler) should read
 * `process.env` directly — import `env` from here instead, so:
 *
 *   1. Missing/malformed config fails fast at boot with one clear error,
 *      instead of surfacing as a confusing runtime failure three layers deep.
 *   2. Every consumer gets a typed, parsed value (durations already coerced
 *      to ms, URLs already validated) instead of a raw string.
 */

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]).default("info"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),

  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

  /** "Proteção contra sessão duplicada" — false revokes every other session on new login. */
  AUTH_ALLOW_CONCURRENT_SESSIONS: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v !== "false"),

  /** MFA schema/plumbing is fully prepared (see identity module) but no verification flow is wired — stays off until a real TOTP/SMS/Email OTP integration lands. */
  MFA_ENABLED: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),

  /** 32-byte key, base64-encoded — `openssl rand -base64 32`. Used by server/security's AES-256-GCM helpers. */
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),

  /** Comma-separated allowlist of origins allowed to call the API cross-origin (empty = same-origin only). */
  CORS_ALLOWED_ORIGINS: z.string().optional().default(""),

  WS_PORT: z.coerce.number().int().positive().default(3001),

  UPLOADS_DRIVER: z.enum(["local", "s3"]).default("local"),
  UPLOADS_LOCAL_DIR: z.string().default("./.uploads"),
  UPLOADS_S3_BUCKET: z.string().optional().default(""),
  UPLOADS_S3_REGION: z.string().optional().default(""),
  UPLOADS_S3_ACCESS_KEY_ID: z.string().optional().default(""),
  UPLOADS_S3_SECRET_ACCESS_KEY: z.string().optional().default(""),

  /** WebPushProvider (src/modules/notifications) — `node -e "console.log(require('web-push').generateVAPIDKeys())"`. */
  VAPID_PUBLIC_KEY: z.string().min(1, "VAPID_PUBLIC_KEY is required"),
  VAPID_PRIVATE_KEY: z.string().min(1, "VAPID_PRIVATE_KEY is required"),
  VAPID_SUBJECT: z.string().min(1, "VAPID_SUBJECT is required"),

  SENTRY_DSN: z.string().optional().default(""),
  METRICS_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v === "true"),

  FEATURE_FLAGS: z.string().optional().default(""),

  /**
   * Zone base URLs (src/proxy.ts's host-based routing, src/config/domains.ts)
   * — public on purpose, see AGENTS.md "Fase Deploy: Domínios/Subdomínios/
   * Produção". Declared and Zod-validated here so a malformed URL fails the
   * boot fast; application code should import the parsed values from
   * `@/config/domains` instead (that module also works client-side, this
   * one doesn't).
   */
  NEXT_PUBLIC_PLAYER_URL: z.string().url().default("http://player.localhost:3000"),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().default("http://admin.localhost:3000"),
  NEXT_PUBLIC_MANAGER_URL: z.string().url().default("http://manager.localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://api.localhost:3000"),

  /**
   * Auth cookie `Domain` attribute — empty (default) means host-only
   * cookies, so a session from one zone is never sent to another. See
   * src/config/domains.ts's `COOKIE_DOMAIN` doc comment for the full
   * rationale. Deliberately NOT a `z.string().url()` — this is a bare
   * hostname suffix like `.helixcoin.bet`, not a URL.
   */
  NEXT_PUBLIC_COOKIE_DOMAIN: z.string().optional().default(""),

  /**
   * Official community link (WhatsApp) — src/config/community.ts. Optional
   * and empty by default; the WhatsApp button only renders once this is
   * actually set, never falls back to a guessed URL.
   */
  NEXT_PUBLIC_COMMUNITY_URL: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // Intentionally logged before the logger exists (config loads first) —
    // this is the one place in the codebase allowed to use console directly.
    console.error(`Invalid environment configuration:\n${issues}`);
    throw new Error("Invalid environment configuration — see stderr for details.");
  }
  return parsed.data;
}

// Module-scope singleton: validated once per process, on first import.
export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
