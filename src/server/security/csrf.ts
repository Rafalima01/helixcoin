import { randomBytes, timingSafeEqual } from "node:crypto";

export const CSRF_COOKIE_NAME = "hj_csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Double-submit-cookie CSRF protection, available for any cookie-authenticated
 * POST/PUT/DELETE route. Not currently required: the identity module's
 * access/refresh cookies (server/auth/cookies.ts) are set `SameSite=Strict`,
 * which already blocks the cross-site request forgery vector on its own —
 * this stays as defense-in-depth infrastructure a route can opt into.
 * Bearer-token API routes (server/auth's JWT flow) aren't vulnerable to CSRF
 * in the first place — a browser can't be tricked into attaching an
 * `Authorization` header — so they don't need this either.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | undefined
): boolean {
  if (!cookieToken || !headerToken) return false;
  if (cookieToken.length !== headerToken.length) return false;
  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
}
