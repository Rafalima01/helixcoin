import { randomBytes, timingSafeEqual } from "node:crypto";

export const CSRF_COOKIE_NAME = "hj_csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Double-submit-cookie CSRF protection for any future cookie-authenticated
 * POST/PUT/DELETE route outside NextAuth's own routes (which already
 * handle CSRF internally — this is for a module that adds its own
 * cookie-based mutation endpoint). Bearer-token API routes (server/auth's
 * JWT flow) aren't vulnerable to CSRF in the first place — a browser can't
 * be tricked into attaching an `Authorization` header — so they don't need
 * this.
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
