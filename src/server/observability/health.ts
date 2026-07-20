import { prisma } from "@/lib/prisma";
import { redis } from "@/server/cache/redis";

export interface DependencyCheck {
  status: "ok" | "error";
  latencyMs: number;
  error?: string;
}

const CHECK_TIMEOUT_MS = 3000;

/**
 * A readiness probe exists to answer "can this instance serve traffic"
 * QUICKLY — an orchestrator polling it needs a fast, bounded answer either
 * way. Racing against an explicit timeout is defense in depth: it doesn't
 * rely on the underlying client's own retry/timeout policy being tuned
 * correctly (ioredis and Prisma both have their own, and getting one wrong
 * elsewhere shouldn't be able to make this hang — see server/cache/redis.ts's
 * doc comment for the specific way this bit us once already).
 */
async function timed(fn: () => Promise<void>): Promise<DependencyCheck> {
  const start = performance.now();
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timed out after ${CHECK_TIMEOUT_MS}ms`)),
          CHECK_TIMEOUT_MS
        )
      ),
    ]);
    return { status: "ok", latencyMs: Math.round(performance.now() - start) };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export function checkDatabase(): Promise<DependencyCheck> {
  return timed(async () => {
    await prisma.$queryRaw`SELECT 1`;
  });
}

export function checkRedis(): Promise<DependencyCheck> {
  return timed(async () => {
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error(`Unexpected PING response: ${pong}`);
  });
}
