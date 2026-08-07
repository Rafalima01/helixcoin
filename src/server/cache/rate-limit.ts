import type { NextRequest } from "next/server";
import { redis } from "@/server/cache/redis";
import { RateLimitError } from "@/server/errors";
import { env } from "@/server/config/env";
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
  /** src/modules/match-engine's /progress checkpoint — called every few seconds during active play, keyed by IP (see `identify` limitation noted at `withRateLimit`). */
  matchProgress: createRateLimiter({ prefix: "rl:match-progress", windowSeconds: 10, max: 30 }),
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

/**
 * Default identifier: the caller's real IP, resolved so a client can never
 * pick their own rate-limit bucket by forging a header.
 *
 * Checked in order, each only trusted because the edge that sets it
 * OVERWRITES (not appends) whatever the client sent:
 *   1. `CF-Connecting-IP` — Cloudflare's own header — but ONLY when
 *      `TRUSTED_CF_CONNECTING_IP=true`. Cloudflare does not front this
 *      deployment yet (DEPLOYMENT.md), and nothing else strips or
 *      overwrites this header — trusting it unconditionally would let a
 *      client set it directly and defeat every IP-keyed limiter, which is
 *      worse than not checking it at all. Flip the env var on once
 *      Cloudflare is actually confirmed to be the sole entry point.
 *   2. `X-Real-IP` — set unconditionally to `$remote_addr` by the documented
 *      Nginx config (DEPLOYMENT.md: `proxy_set_header X-Real-IP $remote_addr;`),
 *      i.e. the actual TCP peer Nginx saw, never client-suppliable.
 *   3. `X-Forwarded-For`, read from the RIGHT using `TRUSTED_PROXY_HOPS`
 *      (default 1) — the fallback for a proxy that only sets XFF. Nginx's
 *      documented config APPENDS to XFF
 *      (`$proxy_add_x_forwarded_for`) rather than overwriting it, so with
 *      exactly one trusted hop the real client IP is the LAST value, not
 *      the first — the first is whatever an attacker sent, and trusting it
 *      (the previous behavior here) let a single header defeat every
 *      IP-keyed limiter (login, password reset, webhooks, admin).
 *   4. `"unknown"` — shared bucket, same fallback as before.
 */
export function ipFromRequest(req: NextRequest): string {
  if (env.TRUSTED_CF_CONNECTING_IP) {
    const cfConnectingIp = req.headers.get("cf-connecting-ip")?.trim();
    if (cfConnectingIp) return cfConnectingIp;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const hops = forwardedFor
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    const clientIp = hops[Math.max(0, hops.length - env.TRUSTED_PROXY_HOPS)];
    if (clientIp) return clientIp;
  }

  return "unknown";
}
