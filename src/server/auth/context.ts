import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";
import { createChildLogger } from "@/server/logger";
import { verifyAccessToken } from "@/server/auth/jwt";
import { isAccessTokenBlacklisted } from "@/server/auth/tokens";
import { hasRole } from "@/server/auth/rbac";

const logger = createChildLogger({ module: "auth.context" });

export interface AuthContext {
  userId: string;
  role?: Role;
  sessionId: string;
}

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

/**
 * Resolves the caller's identity from the `Authorization: Bearer <jwt>`
 * header. Returns `null` for a missing/invalid/expired/blacklisted token —
 * it never throws, so callers decide whether the route requires auth
 * (`requireAuth`) or merely benefits from knowing who's calling if present.
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  try {
    const claims = await verifyAccessToken(token);
    if (await isAccessTokenBlacklisted(claims.sessionId)) return null;
    return { userId: claims.sub, role: claims.role, sessionId: claims.sessionId };
  } catch (err) {
    logger.debug({ err }, "Access token verification failed");
    return null;
  }
}

export function requireAuth(ctx: AuthContext | null): AuthContext {
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

export function requireRole(ctx: AuthContext | null, ...allowed: Role[]): AuthContext {
  const authed = requireAuth(ctx);
  if (!hasRole(authed.role, allowed)) throw new ForbiddenError();
  return authed;
}
