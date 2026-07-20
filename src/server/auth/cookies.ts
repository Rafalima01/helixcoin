import type { NextResponse } from "next/server";
import { isProduction } from "@/server/config/env";
import { parseDurationSeconds } from "@/server/auth/tokens";
import { env } from "@/server/config/env";

export const REFRESH_COOKIE_NAME = "hj_refresh_token";

/** httpOnly refresh-token cookie for browser clients (mobile/API clients send it in the body instead). */
export function setRefreshCookie(res: NextResponse, refreshToken: string): void {
  res.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: parseDurationSeconds(env.JWT_REFRESH_TTL),
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.set(REFRESH_COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}
