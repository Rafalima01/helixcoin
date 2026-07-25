import type { NextRequest } from "next/server";
import type { GameMode, MatchStatus } from "@prisma/client";
import { ok, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { matchEngineContainer } from "@/modules/match-engine/container";
import { adminMatchListQuerySchema } from "@/modules/match-engine/validators/match.validator";
import { toMatchSummaryDto, toMatchDetailDto } from "@/modules/match-engine/dto/match.dto";

const { matchEngineService } = matchEngineContainer;
const { permissionService } = identityContainer;

/** Either seeded permission key (game.manage/rtp.manage were the Phase 4 precedent) doesn't apply here — matches.read is its own dedicated key, read-only by design ("Nunca permitir edição"). */
async function assertMatchesReadPermission(auth: AuthContext): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, "matches.read"))) {
    throw new ForbiddenError();
  }
}

export async function handleListMatchesAdmin(req: NextRequest, auth: AuthContext) {
  await assertMatchesReadPermission(auth);

  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminMatchListQuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
    mode: url.searchParams.get("mode") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const { items, total } = await matchEngineService.listForAdmin({
    status: query.status as MatchStatus | undefined,
    mode: query.mode as GameMode | undefined,
    userId: query.userId,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toMatchSummaryDto), buildPaginationMeta(pagination, total));
}

export async function handleGetMatchAdmin(_req: NextRequest, auth: AuthContext, matchId: string) {
  await assertMatchesReadPermission(auth);
  const { match, events } = await matchEngineService.getDetailForAdmin(matchId);
  return ok(toMatchDetailDto(match, events));
}
