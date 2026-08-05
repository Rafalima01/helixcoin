import type { NextRequest } from "next/server";
import { ok, created } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import {
  setAccessCookie,
  clearAccessCookie,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
} from "@/server/auth/cookies";
import { parseDurationSeconds } from "@/server/auth/tokens";
import { extractRequestMeta } from "@/server/audit";
import { registerSchema, loginSchema } from "@/modules/identity/validators/auth.validator";
import { toUserResponseDto } from "@/modules/identity/dto/user.dto";
import {
  SESSION_TTL_DEFAULT,
  SESSION_TTL_REMEMBER_ME,
} from "@/modules/identity/constants/identity.constants";
import { ValidationError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { affiliateContainer } from "@/modules/affiliate/container";

const { authService, userManagementService } = identityContainer;

export async function handleRegister(req: NextRequest) {
  const body = registerSchema.parse(await req.json());
  const meta = extractRequestMeta(req);

  // Cross-module resolution happens here (the HTTP boundary), not inside
  // AuthService — see auth.service.ts's register() doc comment. A bad/
  // paused/missing slug just means no analytics tag, never blocks signup.
  let affiliateLinkId: string | null = null;
  if (body.affiliateLinkSlug) {
    const link = await affiliateContainer.affiliateLinkService.findActiveBySlug(body.affiliateLinkSlug);
    if (link) affiliateLinkId = link.id;
  }

  const user = await authService.register(
    { ...body, referralCode: body.referralCode || undefined },
    meta,
    affiliateLinkId
  );

  // Every player is a real, paid affiliate from the moment they sign up —
  // no request/approval step (see AffiliateService.autoEnroll's doc
  // comment). Best-effort: enrollment failing must never fail signup
  // itself — handleGetMyAffiliateProfile self-heals this on first visit to
  // the "Indique" tab if this call is ever skipped or races a cold start.
  await affiliateContainer.affiliateService.autoEnroll(user.id).catch(() => {});

  // Atomic manager attribution for the "Convidar Afiliados" flow (see
  // /affiliate-invite/[code]/route.ts) — mirrors the best-effort,
  // never-block-signup pattern of autoEnroll() above. assignManagerIfUnset()
  // itself is a no-op if the code doesn't resolve or the profile already has
  // a manager (first-touch wins), so this is safe to call unconditionally.
  if (body.managerCode) {
    await affiliateContainer.affiliateService.assignManagerIfUnset(user.id, body.managerCode).catch(() => {});
  }

  return created({ user: toUserResponseDto(user) });
}

export async function handleLogin(req: NextRequest) {
  const body = loginSchema.parse(await req.json());
  const meta = extractRequestMeta(req);

  const result = await authService.login(body, meta);

  const res = ok({ user: toUserResponseDto(result.user) });
  setAccessCookie(res, result.accessToken);
  const refreshTtl = body.rememberMe ? SESSION_TTL_REMEMBER_ME : SESSION_TTL_DEFAULT;
  setRefreshCookie(res, result.refreshToken, parseDurationSeconds(refreshTtl));
  return res;
}

export async function handleRefresh(req: NextRequest) {
  const cookieToken = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  const body = cookieToken ? null : ((await req.json().catch(() => null)) as { refreshToken?: string } | null);
  const refreshToken = cookieToken ?? body?.refreshToken;
  if (!refreshToken) throw new ValidationError("Refresh token ausente");

  const result = await authService.refresh(refreshToken);

  const res = ok({});
  setAccessCookie(res, result.accessToken);
  setRefreshCookie(res, result.refreshToken);
  return res;
}

export async function handleLogout(req: NextRequest, auth: AuthContext) {
  const meta = extractRequestMeta(req);
  await authService.logout(
    { sub: auth.userId, role: auth.role, sessionId: auth.sessionId, familyId: auth.familyId },
    meta
  );

  const res = ok({});
  clearAccessCookie(res);
  clearRefreshCookie(res);
  return res;
}

export async function handleMe(_req: NextRequest, auth: AuthContext) {
  const user = await userManagementService.getById(auth.userId);
  return ok({ user: toUserResponseDto(user) });
}
