import { cookies } from "next/headers";
import { verifyAccessToken } from "@/server/auth/jwt";
import { isAccessTokenBlacklisted } from "@/server/auth/tokens";
import { ACCESS_COOKIE_NAME } from "@/server/auth/cookies";
import type { AuthContext } from "@/server/auth/context";

/**
 * `getAuthContext` (context.ts) needs a `NextRequest` — unavailable to
 * Server Components, which read the incoming cookies via `next/headers`
 * instead. Same verification logic, different cookie source.
 */
export async function getServerAuthContext(): Promise<AuthContext | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const claims = await verifyAccessToken(token);
    if (await isAccessTokenBlacklisted(claims.sessionId)) return null;
    return { userId: claims.sub, role: claims.role, sessionId: claims.sessionId, familyId: claims.familyId };
  } catch {
    return null;
  }
}
