import { createRouteHandler, ok, fail } from "@/server/http";
import { checkDatabase, checkRedis } from "@/server/observability";

/**
 * Readiness — "can this instance actually serve traffic right now". Checks
 * every hard dependency; an orchestrator should stop routing to an
 * instance that fails this (but not necessarily kill it — that's
 * liveness's job).
 */
export const GET = createRouteHandler(async () => {
  const [database, cache] = await Promise.all([checkDatabase(), checkRedis()]);
  const healthy = database.status === "ok" && cache.status === "ok";
  const body = { status: healthy ? "ok" : "degraded", checks: { database, cache } };

  if (!healthy) {
    return fail({
      status: 503,
      body: { error: { code: "NOT_READY", message: "Dependency check failed", details: body } },
    });
  }
  return ok(body);
});
