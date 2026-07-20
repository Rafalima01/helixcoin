import type { NextResponse } from "next/server";
import { isProduction } from "@/server/config/env";
import { parseDurationSeconds } from "@/server/auth/tokens";
import { env } from "@/server/config/env";

export const REFRESH_COOKIE_NAME = "hj_refresh_token";
export const ACCESS_COOKIE_NAME = "hj_access_token";

/** httpOnly refresh-token cookie for browser clients (mobile/API clients send it in the body instead). */
export function setRefreshCookie(res: NextResponse, refreshToken: string, ttlSeconds?: number): void {
  res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: ttlSeconds ?? parseDurationSeconds(env.JWT_REFRESH_TTL),
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.set(REFRESH_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
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
    maxAge: parseDurationSeconds(env.JWT_ACCESS_TTL),
  });
}

export function clearAccessCookie(res: NextResponse): void {
  res.cookies.set(ACCESS_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}
