import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { ForbiddenError, UnauthorizedError } from "@/server/errors";
import { createChildLogger } from "@/server/logger";
import { verifyAccessToken } from "@/server/auth/jwt";
import { isAccessTokenBlacklisted } from "@/server/auth/tokens";
import { hasRole } from "@/server/auth/rbac";
import { ACCESS_COOKIE_NAME } from "@/server/auth/cookies";

const logger = createChildLogger({ module: "auth.context" });

export interface AuthContext {
  userId: string;
  role?: Role;
  sessionId: string;
  familyId: string;
}

/** Bearer header first (headless/mobile/API clients), then the httpOnly cookie (same-origin web app). */
function extractAccessToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token) return token;
  }
  return req.cookies.get(ACCESS_COOKIE_NAME)?.value ?? null;
}

/**
 * Resolves the caller's identity from the `Authorization: Bearer <jwt>`
 * header or the httpOnly access-token cookie. Returns `null` for a
 * missing/invalid/expired/blacklisted token — it never throws, so callers
 * decide whether the route requires auth (`requireAuth`) or merely
 * benefits from knowing who's calling if present.
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const token = extractAccessToken(req);
  if (!token) return null;

  try {
    const claims = await verifyAccessToken(token);
    if (await isAccessTokenBlacklisted(claims.sessionId)) return null;
    return { userId: claims.sub, role: claims.role, sessionId: claims.sessionId, familyId: claims.familyId };
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
