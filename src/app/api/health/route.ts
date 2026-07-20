import { createRouteHandler, ok } from "@/server/http";

/**
 * Liveness — "is the process able to respond at all". Deliberately checks
 * nothing external (no DB/Redis) so a downstream outage doesn't get an
 * orchestrator to kill and restart a perfectly healthy process. That's
 * what /api/health/ready is for.
 */
export const GET = createRouteHandler(async () => {
  return ok({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});
