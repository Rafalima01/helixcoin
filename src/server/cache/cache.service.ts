import { redis } from "@/server/cache/redis";
import { createChildLogger } from "@/server/logger";

const logger = createChildLogger({ module: "cache" });

/**
 * Thin, typed wrapper over the raw Redis client. Every consumer (auth
 * refresh-token storage, rate limiting, future module caches) goes through
 * this instead of calling `redis.get`/`redis.set` directly — one place to
 * change serialization or add metrics later.
 */
export const CacheService = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await redis.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      logger.warn({ key }, "Failed to parse cached value as JSON");
      return null;
    }
  },

  /** @param ttlSeconds omit for no expiry (only appropriate for values you explicitly invalidate). */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const raw = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.set(key, raw, "EX", ttlSeconds);
    } else {
      await redis.set(key, raw);
    }
  },

  async del(key: string): Promise<void> {
    await redis.del(key);
  },

  async exists(key: string): Promise<boolean> {
    return (await redis.exists(key)) === 1;
  },

  async ttl(key: string): Promise<number> {
    return redis.ttl(key);
  },

  /**
   * Fetch-or-compute with caching — the shape every future module's
   * "cached repository read" will use.
   */
  async remember<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const cached = await CacheService.get<T>(key);
    if (cached !== null) return cached;
    const value = await compute();
    await CacheService.set(key, value, ttlSeconds);
    return value;
  },

  /**
   * Minimal distributed lock (SET NX PX + token-checked release). Good
   * enough for single-instance-at-a-time job coordination; swap for
   * Redlock across multiple Redis nodes if that's ever the topology.
   */
  async withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T | null> {
    const lockKey = `lock:${key}`;
    const token = crypto.randomUUID();
    const acquired = await redis.set(lockKey, token, "PX", ttlMs, "NX");
    if (acquired !== "OK") {
      logger.debug({ key }, "Lock not acquired — another holder is active");
      return null;
    }
    try {
      return await fn();
    } finally {
      // Only release if we still hold it (avoids deleting a lock some other
      // process acquired after ours expired mid-flight).
      const current = await redis.get(lockKey);
      if (current === token) await redis.del(lockKey);
    }
  },
};
