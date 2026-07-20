import pino from "pino";
import { env, isDevelopment } from "@/server/config/env";

/**
 * Central logger. Every server module (services, repositories, workers,
 * route handlers) logs through this — never `console.log`. Levels follow
 * pino's standard scale: trace < debug < info < warn < error < fatal.
 *
 * - Dev: pretty-printed, colorized (pino-pretty transport).
 * - Prod: newline-delimited JSON to stdout, ready for any log shipper
 *   (Loki, CloudWatch, Datadog) to pick up without a code change here.
 */
export const rootLogger = pino({
  level: env.LOG_LEVEL,
  base: { service: "helijump-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
      }
    : undefined,
});

/**
 * Scope a logger to a module/service so every line it emits is tagged —
 * e.g. `createChildLogger({ module: "wallet.service" })`.
 */
export function createChildLogger(bindings: Record<string, unknown>): pino.Logger {
  return rootLogger.child(bindings);
}

export type Logger = pino.Logger;
