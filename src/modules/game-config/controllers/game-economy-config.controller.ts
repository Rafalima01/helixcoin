import type { NextRequest } from "next/server";
import { ok, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { extractRequestMeta } from "@/server/audit";
import { ForbiddenError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { gameConfigContainer } from "@/modules/game-config/container";
import {
  upsertDraftSchema,
  activateSchema,
} from "@/modules/game-config/validators/game-economy-config.validator";
import {
  toGameEconomyConfigResponseDto,
  toVersionSummaryDto,
} from "@/modules/game-config/dto/game-economy-config.dto";

const { gameConfigService } = gameConfigContainer;
const { permissionService } = identityContainer;

/** Either seeded permission key grants full access — this module edits one unified JSON blob, not split by field. */
async function assertGameConfigPermission(auth: AuthContext): Promise<void> {
  if (!auth.role) throw new ForbiddenError();
  const [canManageGame, canManageRtp] = await Promise.all([
    permissionService.hasPermission(auth.role, "game.manage"),
    permissionService.hasPermission(auth.role, "rtp.manage"),
  ]);
  if (!canManageGame && !canManageRtp) throw new ForbiddenError();
}

export async function handleGetGameConfig(_req: NextRequest, auth: AuthContext) {
  await assertGameConfigPermission(auth);
  const [active, draft] = await Promise.all([
    gameConfigService.getActive().catch(() => null),
    gameConfigService.getDraft(),
  ]);
  return ok({
    active: active ? toGameEconomyConfigResponseDto(active) : null,
    draft: draft ? toGameEconomyConfigResponseDto(draft) : null,
  });
}

export async function handleUpsertDraft(req: NextRequest, auth: AuthContext) {
  await assertGameConfigPermission(auth);
  const body = upsertDraftSchema.parse(await req.json());
  const meta = extractRequestMeta(req);

  const draft = await gameConfigService.upsertDraft(body, {
    actorId: auth.userId,
    actorType: "USER",
    actorRole: auth.role,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return ok(toGameEconomyConfigResponseDto(draft));
}

export async function handleActivateDraft(req: NextRequest, auth: AuthContext) {
  await assertGameConfigPermission(auth);
  const body = activateSchema.parse(await req.json().catch(() => ({})));
  const meta = extractRequestMeta(req);

  const activated = await gameConfigService.activate(
    { actorId: auth.userId, actorType: "USER", actorRole: auth.role, ip: meta.ip, userAgent: meta.userAgent },
    body.versionId
  );
  return ok(toGameEconomyConfigResponseDto(activated));
}

export async function handleListGameConfigVersions(req: NextRequest, auth: AuthContext) {
  await assertGameConfigPermission(auth);
  const pagination = parsePagination(req.nextUrl.searchParams);
  const { items, total } = await gameConfigService.listVersions(pagination.page, pagination.pageSize);
  return ok(items.map(toVersionSummaryDto), buildPaginationMeta(pagination, total));
}

export async function handleRestoreGameConfigVersion(
  req: NextRequest,
  auth: AuthContext,
  versionId: string
) {
  await assertGameConfigPermission(auth);
  const meta = extractRequestMeta(req);

  const draft = await gameConfigService.restore(versionId, {
    actorId: auth.userId,
    actorType: "USER",
    actorRole: auth.role,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return ok(toGameEconomyConfigResponseDto(draft));
}
