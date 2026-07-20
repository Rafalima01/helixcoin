import type { Role } from "@prisma/client";
import { redis } from "@/server/cache/redis";
import { CacheService } from "@/server/cache/cache.service";
import { UnauthorizedError } from "@/server/errors";
import { createChildLogger } from "@/server/logger";
import { env } from "@/server/config/env";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type AccessTokenClaims,
} from "@/server/auth/jwt";

const logger = createChildLogger({ module: "auth.tokens" });

/**
 * Session/refresh-token lifecycle, backed by Redis. This is what turns raw
 * JWT sign/verify (jwt.ts) into actual "log out this device", "rotate on
 * every refresh", "detect a stolen refresh token" behavior:
 *
 * - Each refresh token is single-use ("rotation"): using it issues a new
 *   pair and immediately invalidates the old session.
 * - All sessions descending from one login share a `familyId`. If a
 *   refresh token is presented twice (its session is already gone), that's
 *   a strong signal it was stolen and replayed — the entire family is
 *   revoked, logging out every device on that login chain.
 * - Access tokens are stateless (not looked up on every request) but can be
 *   individually blacklisted (logout, admin-forced revocation) for the
 *   remainder of their short TTL.
 */

const sessionKey = (sessionId: string) => `auth:session:${sessionId}`;
const familyKey = (familyId: string) => `auth:family:${familyId}`;
const blacklistKey = (sessionId: string) => `auth:blacklist:${sessionId}`;

interface SessionRecord {
  userId: string;
  role?: Role;
  familyId: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  familyId: string;
}

/** Parses "15m" / "30d" / "45s" / "2h" into seconds — the same format jose's setExpirationTime accepts. */
export function parseDurationSeconds(input: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration string: "${input}" (expected e.g. "15m", "30d")`);
  const value = Number(match[1]);
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 } as const;
  return value * multipliers[match[2] as keyof typeof multipliers];
}

export async function issueTokenPair(
  userId: string,
  role?: Role,
  familyId: string = crypto.randomUUID()
): Promise<IssuedTokens> {
  const sessionId = crypto.randomUUID();
  const ttlSeconds = parseDurationSeconds(env.JWT_REFRESH_TTL);

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: userId, role, sessionId }),
    signRefreshToken({ sub: userId, sessionId, familyId }),
  ]);

  const record: SessionRecord = { userId, role, familyId };
  await CacheService.set(sessionKey(sessionId), record, ttlSeconds);
  await redis.sadd(familyKey(familyId), sessionId);
  await redis.expire(familyKey(familyId), ttlSeconds);

  return { accessToken, refreshToken, sessionId, familyId };
}

export async function rotateRefreshToken(refreshToken: string): Promise<IssuedTokens> {
  const claims = await verifyRefreshToken(refreshToken); // throws JWTExpired/JWTInvalid
  const session = await CacheService.get<SessionRecord>(sessionKey(claims.sessionId));

  if (!session) {
    logger.warn(
      { sessionId: claims.sessionId, familyId: claims.familyId },
      "Refresh token reuse detected — revoking family"
    );
    await revokeFamily(claims.familyId);
    throw new UnauthorizedError("Refresh token reuse detected — session revoked");
  }

  await revokeSession(claims.sessionId);
  return issueTokenPair(session.userId, session.role, claims.familyId);
}

export async function revokeSession(sessionId: string): Promise<void> {
  const session = await CacheService.get<SessionRecord>(sessionKey(sessionId));
  await CacheService.del(sessionKey(sessionId));
  if (session) await redis.srem(familyKey(session.familyId), sessionId);
}

/** Logs out every device descended from one login — used on reuse detection or "log out everywhere". */
export async function revokeFamily(familyId: string): Promise<void> {
  const sessionIds = await redis.smembers(familyKey(familyId));
  if (sessionIds.length > 0) {
    await redis.del(...sessionIds.map(sessionKey));
  }
  await redis.del(familyKey(familyId));
}

export async function blacklistAccessToken(claims: AccessTokenClaims): Promise<void> {
  const remaining = (claims.exp ?? 0) - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return;
  await CacheService.set(blacklistKey(claims.sessionId), true, remaining);
}

export async function isAccessTokenBlacklisted(sessionId: string): Promise<boolean> {
  return CacheService.exists(blacklistKey(sessionId));
}
