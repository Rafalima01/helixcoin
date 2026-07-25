import type { NextResponse } from "next/server";
import { isProduction } from "@/server/config/env";
import { parseDurationSeconds } from "@/server/auth/tokens";
import { env } from "@/server/config/env";
import { COOKIE_DOMAIN } from "@/config/domains";

export const REFRESH_COOKIE_NAME = "hj_refresh_token";
export const ACCESS_COOKIE_NAME = "hj_access_token";

/**
 * Every auth cookie attribute, decided once here — see AGENTS.md "Fase
 * Deploy: Domínios/Subdomínios/Produção" ("Cookies") and
 * src/config/domains.ts's `COOKIE_DOMAIN` doc comment for the full
 * rationale of each:
 *
 * - `domain`: `COOKIE_DOMAIN` (empty in dev, `.helixcoin.bet` in production
 *   — see DEPLOYMENT.md) → `undefined` when empty, which omits the `Domain`
 *   attribute and makes the cookie host-only (dev's per-zone isolation, no
 *   change needed there). In production the cookie is intentionally shared
 *   across `*.helixcoin.bet`, so `src/proxy.ts` can recognize a session from
 *   any zone and redirect automatically on a role mismatch — the actual "o
 *   login do Player não interfere no Admin" guarantee comes from the
 *   middleware's role gate (which zone a session is *authorized* to use),
 *   not from cookie visibility (which zones can *see* the session exists).
 *   See src/config/domains.ts's `COOKIE_DOMAIN` doc comment for the full
 *   rationale.
 * - `secure`: true in production (cookie never leaves an HTTPS connection),
 *   false in dev (`http://*.localhost` has no TLS).
 * - `sameSite: "strict"`: cookie is never sent on a cross-site request —
 *   this is the actual CSRF defense (see server/security/csrf.ts's doc
 *   comment); the double-submit CSRF module is defense-in-depth on top.
 * - `httpOnly: true`: never readable from client-side JS (XSS mitigation).
 * - `path: "/"`: valid for the whole zone, not just the route that set it.
 */
const authCookieDomain = COOKIE_DOMAIN || undefined;

/** httpOnly refresh-token cookie for browser clients (mobile/API clients send it in the body instead). */
export function setRefreshCookie(res: NextResponse, refreshToken: string, ttlSeconds?: number): void {
  res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    domain: authCookieDomain,
    maxAge: ttlSeconds ?? parseDurationSeconds(env.JWT_REFRESH_TTL),
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.set(REFRESH_COOKIE_NAME, "", { httpOnly: true, path: "/", domain: authCookieDomain, maxAge: 0 });
}

/**
 * httpOnly access-token cookie — used alongside the refresh cookie for the
 * same-origin player/admin web app (see auth/context.ts's `getAuthContext`,
 * which checks this cookie in addition to the `Authorization: Bearer`
 * header). Headless/mobile clients keep using the Bearer header instead.
 */
export function setAccessCookie(res: NextResponse, accessToken: string): void {
  res.cookies.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    domain: authCookieDomain,
    maxAge: parseDurationSeconds(env.JWT_ACCESS_TTL),
  });
}

export function clearAccessCookie(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE_NAME, "", { httpOnly: true, path: "/", domain: authCookieDomain, maxAge: 0 });
}
