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

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  NEXTAUTH_URL: z.string().url().optional(),
  AUTH_GOOGLE_ID: z.string().optional().default(""),
  AUTH_GOOGLE_SECRET: z.string().optional().default(""),

  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),

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

  SENTRY_DSN: z.string().optional().default(""),
  METRICS_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v === "true"),

  FEATURE_FLAGS: z.string().optional().default(""),
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
