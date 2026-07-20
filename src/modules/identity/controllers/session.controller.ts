import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { extractRequestMeta } from "@/server/audit";
import { toSessionResponseDto } from "@/modules/identity/dto/session.dto";
import { identityContainer } from "@/modules/identity/container";

const { sessionService } = identityContainer;

export async function handleListSessions(_req: NextRequest, auth: AuthContext) {
  const sessions = await sessionService.listSessions(auth.userId);
  return ok(sessions.map((s) => toSessionResponseDto(s, auth.familyId)));
}

export async function handleRevokeSession(req: NextRequest, auth: AuthContext, sessionId: string) {
  const meta = extractRequestMeta(req);
  await sessionService.revokeSession(auth.userId, sessionId, meta);
  return ok({});
}

export async function handleRevokeAllSessions(req: NextRequest, auth: AuthContext) {
  const meta = extractRequestMeta(req);
  const count = await sessionService.revokeAllSessions(auth.userId, meta, auth.familyId);
  return ok({ revokedCount: count });
}
