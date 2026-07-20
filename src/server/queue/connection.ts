import IORedis from "ioredis";
import { env } from "@/server/config/env";

/**
 * BullMQ needs its own Redis connection per Queue/Worker instance (Workers
 * hold blocking `BRPOPLPUSH`-style commands that would starve a shared
 * connection used for regular cache traffic) — separate from
 * server/cache/redis.ts's general-purpose client.
 */
export function createQueueConnection(): IORedis {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
}
