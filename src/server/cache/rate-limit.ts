import type { NextRequest } from "next/server";
import { redis } from "@/server/cache/redis";
import { RateLimitError } from "@/server/errors";
import type { RouteHandler } from "@/server/http/handler";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

export interface RateLimiterOptions {
  /** Redis key prefix, e.g. "rl:login". Keeps limiters isolated from each other. */
  prefix: string;
  windowSeconds: number;
  max: number;
}

/**
 * Fixed-window counter (INCR + EXPIRE) — the standard cheap Redis rate
 * limiter. Not perfectly smooth at window boundaries (a burst can land two
 * windows' worth of requests right at the edge); good enough for the
 * login/API/admin/webhook surfaces this guards, and much simpler to reason
 * about than a sliding-window log for infra nobody has tuned yet.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { prefix, windowSeconds, max } = options;

  return async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${prefix}:${identifier}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    const ttl = await redis.ttl(key);
    const resetAt = new Date(Date.now() + Math.max(0, ttl) * 1000);

    return {
      allowed: count <= max,
      remaining: Math.max(0, max - count),
      limit: max,
      resetAt,
    };
  };
}

/** Throws RateLimitError instead of returning a result — for call sites that just want to guard. */
export async function enforceRateLimit(
  check: ReturnType<typeof createRateLimiter>,
  identifier: string
): Promise<RateLimitResult> {
  const result = await check(identifier);
  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
    throw new RateLimitError("Too many requests — please try again later", retryAfterSeconds);
  }
  return result;
}

/**
 * Named limiters for the surfaces called out in the Phase 2 brief. Windows
 * and thresholds are placeholders — nobody has specified real numbers yet,
 * so these exist to be imported and enforced, not to be treated as tuned.
 */
export const RateLimiters = {
  login: createRateLimiter({ prefix: "rl:login", windowSeconds: 60, max: 10 }),
  api: createRateLimiter({ prefix: "rl:api", windowSeconds: 60, max: 120 }),
  admin: createRateLimiter({ prefix: "rl:admin", windowSeconds: 60, max: 300 }),
  webhooks: createRateLimiter({ prefix: "rl:webhooks", windowSeconds: 60, max: 600 }),
};

/**
 * Route-handler composition, same shape as auth's `withAuth`:
 *   createRouteHandler(withRateLimit(RateLimiters.login, ipFromRequest)(handler))
 *
 * `identify` extracts whatever the limiter should key on (IP, user ID,
 * API key) from the request — left to the call site since it varies per
 * surface (login limits by IP, an authed API route limits by user ID).
 */
export function withRateLimit<Ctx = unknown>(
  limiter: ReturnType<typeof createRateLimiter>,
  identify: (req: NextRequest) => string
) {
  return (handler: RouteHandler<Ctx>): RouteHandler<Ctx> =>
    async (req, ctx) => {
      await enforceRateLimit(limiter, identify(req));
      return handler(req, ctx);
    };
}

/** Default identifier: client IP from `x-forwarded-for`, falling back to a shared bucket. */
export function ipFromRequest(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
