import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/server/config/env";
import type { Role } from "@prisma/client";

/**
 * JWT access/refresh mechanics for headless API clients (mobile apps, the
 * admin backoffice API, server-to-server integrations) — separate from the
 * player web app's NextAuth session cookie, which stays as-is. `jose` (not
 * `jsonwebtoken`) because it works in both the Node runtime (Route
 * Handlers) and the Edge runtime (Next Middleware), so the same verify
 * function can guard either.
 */

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export interface AccessTokenClaims extends JWTPayload {
  sub: string; // user id
  role?: Role;
  sessionId: string;
}

export interface RefreshTokenClaims extends JWTPayload {
  sub: string;
  sessionId: string;
  familyId: string;
}

// Plain (non-JWTPayload-extending) input shapes for the sign functions.
// `Omit<AccessTokenClaims, "iat" | "exp">` looked equivalent but TS resolves
// property types through JWTPayload's index signature in that position,
// widening `sub` to `unknown` — a known interaction between `Omit` and
// interfaces that extend an indexed type. Plain object types sidestep it.
interface SignAccessTokenInput {
  sub: string;
  role?: Role;
  sessionId: string;
}

interface SignRefreshTokenInput {
  sub: string;
  sessionId: string;
  familyId: string;
}

export async function signAccessToken(claims: SignAccessTokenInput): Promise<string> {
  return new SignJWT({ role: claims.role, sessionId: claims.sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(accessSecret);
}

export async function signRefreshToken(claims: SignRefreshTokenInput): Promise<string> {
  return new SignJWT({ sessionId: claims.sessionId, familyId: claims.familyId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_TTL)
    .sign(refreshSecret);
}

/** Throws on an invalid/expired/malformed token — callers decide how to map that. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, accessSecret);
  return payload as AccessTokenClaims;
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
  const { payload } = await jwtVerify(token, refreshSecret);
  return payload as RefreshTokenClaims;
}
