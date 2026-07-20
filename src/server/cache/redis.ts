import Redis from "ioredis";
import { env } from "@/server/config/env";
import { createChildLogger } from "@/server/logger";

const logger = createChildLogger({ module: "redis" });
const globalForRedis = globalThis as unknown as { redis?: Redis };

/**
 * General-purpose Redis connection — cache, rate-limiting, distributed
 * locks, refresh-token storage (see cache.service.ts's key prefixes).
 *
 * NOT shared with BullMQ: server/queue/connection.ts opens its own
 * connection with `maxRetriesPerRequest: null`, which is a BullMQ
 * requirement, not a general one — it means "retry a command forever,
 * never fail it," which is correct for a worker that should wait Redis
 * out, but wrong here. A cache read or a readiness check must fail fast
 * (ioredis's default of 20 retries) instead of hanging forever when Redis
 * is unreachable — this bit us once already: `/api/health/ready` hung
 * indefinitely instead of reporting "degraded" in under a second.
 */
function buildRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    // Connect on first command, not at import time — importing a module
    // that happens to pull this in (e.g. any test that imports
    // server/auth/tokens) must not open a socket as a side effect.
    lazyConnect: true,
  });

  client.on("error", (err) => logger.error({ err }, "Redis connection error"));
  client.on("connect", () => logger.info("Redis connected"));
  client.on("close", () => logger.warn("Redis connection closed"));

  return client;
}

export const redis = globalForRedis.redis ?? buildRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
