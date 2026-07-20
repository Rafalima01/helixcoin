import * as Sentry from "@sentry/node";
import { env, isProduction } from "@/server/config/env";

/**
 * Sentry, gated entirely by `SENTRY_DSN` — unset (the default) means every
 * function here is a no-op, so nothing changes for anyone not using Sentry.
 * This uses `@sentry/node` rather than the full `@sentry/nextjs` package:
 * that integration additionally wraps next.config.ts and generates
 * per-runtime instrumentation files, which is more surface than Phase 2's
 * "prepare the hook, don't wire a real project" scope calls for. Swapping
 * in the full Next.js SDK later is additive, not a rewrite of call sites —
 * everything still goes through `captureException`.
 */
let initialized = false;

function ensureInitialized(): void {
  if (initialized || !env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: isProduction ? 0.1 : 0,
  });
  initialized = true;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!env.SENTRY_DSN) return;
  ensureInitialized();
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
