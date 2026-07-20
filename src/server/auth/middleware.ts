import type { NextRequest, NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import type { RouteHandler } from "@/server/http/handler";
import { getAuthContext, requireAuth, requireRole, type AuthContext } from "@/server/auth/context";

type AuthedHandler<Ctx> = (
  req: NextRequest,
  ctx: Ctx,
  auth: AuthContext
) => Promise<NextResponse> | NextResponse;

/**
 * Composable route guards for the JWT API (headless/mobile/backoffice
 * clients — see jwt.ts's module doc). Compose with the error/logging
 * wrapper: `createRouteHandler(withAuth(async (req, ctx, auth) => ...))`.
 */
export function withAuth<Ctx = unknown>(handler: AuthedHandler<Ctx>): RouteHandler<Ctx> {
  return async (req, ctx) => {
    const auth = requireAuth(await getAuthContext(req));
    return handler(req, ctx, auth);
  };
}

export function withRole<Ctx = unknown>(...roles: Role[]) {
  return (handler: AuthedHandler<Ctx>): RouteHandler<Ctx> =>
    async (req, ctx) => {
      const auth = requireRole(await getAuthContext(req), ...roles);
      return handler(req, ctx, auth);
    };
}
