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
 *
 * Works correctly regardless of `COOKIE_DOMAIN` (src/config/domains.ts —
 * host-only in dev, shared across `*.helixcoin.bet` in production): CSRF's
 * `SameSite` check is about the relationship between the request's
 * initiating site and the cookie's site (registrable domain), not which
 * hosts the cookie is visible to. A request forged from a third-party site
 * never carries the cookie either way; a same-site navigation between our
 * own player/admin/manager subdomains is allowed either way, and isn't a
 * forgery risk since it's still us. A route that adopts this double-submit
 * pattern should set its own `hj_csrf_token` cookie with the same
 * `domain`/`secure`/`sameSite` options as server/auth/cookies.ts, for
 * consistency.
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
