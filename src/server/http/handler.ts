import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createChildLogger } from "@/server/logger";
import { toErrorResult } from "@/server/errors";
import { fail } from "@/server/http/response";
import { recordHttpRequest } from "@/server/observability/metrics";

export type RouteHandler<Ctx = unknown> = (
  req: NextRequest,
  ctx: Ctx
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Route Handler with the cross-cutting concerns every endpoint
 * needs: a request ID (propagated back in `x-request-id` for support/log
 * correlation), start/end logging with timing, and centralized error
 * mapping — so individual handlers just `throw` a typed AppError (or let a
 * ZodError/Prisma error bubble up) instead of hand-rolling try/catch.
 *
 * Usage:
 *   export const GET = createRouteHandler(async (req) => {
 *     const data = await someService.list();
 *     return ok(data);
 *   });
 */
export function createRouteHandler<Ctx = unknown>(handler: RouteHandler<Ctx>): RouteHandler<Ctx> {
  return async (req, ctx) => {
    const requestId = crypto.randomUUID();
    const start = performance.now();
    const log = createChildLogger({
      module: "http",
      requestId,
      method: req.method,
      path: req.nextUrl.pathname,
    });

    log.debug("request start");

    try {
      const res = await handler(req, ctx);
      const durationMs = performance.now() - start;
      log.info({ status: res.status, durationMs: Math.round(durationMs) }, "request complete");
      recordHttpRequest(req.method, req.nextUrl.pathname, res.status, durationMs / 1000);
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (error) {
      const result = toErrorResult(error, {
        requestId,
        method: req.method,
        path: req.nextUrl.pathname,
      });
      recordHttpRequest(
        req.method,
        req.nextUrl.pathname,
        result.status,
        (performance.now() - start) / 1000
      );
      const res = fail(result);
      res.headers.set("x-request-id", requestId);
      return res;
    }
  };
}
