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

const { authService, userManagementService } = identityContainer;

export async function handleRegister(req: NextRequest) {
  const body = registerSchema.parse(await req.json());
  const meta = extractRequestMeta(req);

  const user = await authService.register(
    { ...body, referralCode: body.referralCode || undefined },
    meta
  );

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
