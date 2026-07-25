import type { NextRequest } from "next/server";
import { ok, created, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError } from "@/server/errors";
import { extractRequestMeta } from "@/server/audit";
import { identityContainer } from "@/modules/identity/container";
import { managerContainer } from "@/modules/manager/container";
import { toManagerProfileDto } from "@/modules/manager/dto/manager.dto";
import { toManagerInviteAdminDto, toManagerInvitePublicDto } from "@/modules/manager/dto/manager-invite.dto";
import {
  createManagerInviteSchema,
  adminManagerInviteListQuerySchema,
  acceptManagerInviteSchema,
  approveManagerInviteSchema,
  rejectManagerInviteSchema,
} from "@/modules/manager/validators/manager-invite.validator";
import { zoneUrl } from "@/config/domains";

const { managerInviteService } = managerContainer;
const { permissionService } = identityContainer;

async function assertPermission(auth: AuthContext, key: "manager.read" | "manager.manage"): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, key))) {
    throw new ForbiddenError();
  }
}

/**
 * Always points at the manager zone regardless of which host the Admin was
 * on when generating this (admin.{domain}) — /manager-invite/{token} only
 * exists in the player-zone route tree, but src/proxy.ts aliases
 * manager.{domain}/invite/{token} to it, so that's the public URL we hand out.
 */
function buildInviteLink(_req: NextRequest, rawToken: string): string {
  return zoneUrl("manager", `/invite/${rawToken}`);
}

// ------------------------------------------------------------------ admin

export async function handleCreateManagerInviteAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "manager.manage");
  const body = createManagerInviteSchema.parse(await req.json().catch(() => ({})));
  const meta = extractRequestMeta(req);
  const { invite, rawToken } = await managerInviteService.create(
    { expiresInDays: body.expiresInDays },
    { id: auth.userId, role: auth.role! },
    meta
  );
  const adminRow = await managerInviteService.getByIdAdmin(invite.id);
  return created({ invite: toManagerInviteAdminDto(adminRow), inviteLink: buildInviteLink(req, rawToken) });
}

export async function handleListManagerInvitesAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "manager.read");
  const url = req.nextUrl;
  const query = adminManagerInviteListQuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
    approvalStatus: url.searchParams.get("approvalStatus") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });
  const { items, total } = await managerInviteService.listAdmin({ ...query, page: 1, pageSize: 100 });
  return ok(items.map(toManagerInviteAdminDto), { total });
}

/** Comercial → Gerentes → Solicitações — accepted invites (USED + PENDING_REVIEW) awaiting a verdict. */
export async function handleListPendingApprovalsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "manager.read");
  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const search = url.searchParams.get("search") ?? undefined;
  const { items, total } = await managerInviteService.listPendingApprovals({ search, page: pagination.page, pageSize: pagination.pageSize });
  return ok(items.map(toManagerInviteAdminDto), buildPaginationMeta(pagination, total));
}

export async function handleApproveManagerInviteAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "manager.manage");
  const body = approveManagerInviteSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  const profile = await managerInviteService.approve(id, body.commissionPercent, { id: auth.userId, role: auth.role! }, meta);
  return ok(toManagerProfileDto(profile));
}

export async function handleRejectManagerInviteAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "manager.manage");
  const body = rejectManagerInviteSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  await managerInviteService.reject(id, body.reason, { id: auth.userId, role: auth.role! }, meta);
  const adminRow = await managerInviteService.getByIdAdmin(id);
  return ok(toManagerInviteAdminDto(adminRow));
}

export async function handleGetManagerInviteAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "manager.read");
  const invite = await managerInviteService.getByIdAdmin(id);
  return ok(toManagerInviteAdminDto(invite));
}

export async function handleRegenerateManagerInviteAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "manager.manage");
  const meta = extractRequestMeta(req);
  const { rawToken } = await managerInviteService.regenerate(id, { id: auth.userId, role: auth.role! }, meta);
  const adminRow = await managerInviteService.getByIdAdmin(id);
  return ok({ invite: toManagerInviteAdminDto(adminRow), inviteLink: buildInviteLink(req, rawToken) });
}

export async function handleRevokeManagerInviteAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "manager.manage");
  const meta = extractRequestMeta(req);
  await managerInviteService.revoke(id, { id: auth.userId, role: auth.role! }, meta);
  const adminRow = await managerInviteService.getByIdAdmin(id);
  return ok(toManagerInviteAdminDto(adminRow));
}

// ----------------------------------------------------------------- public
// No AuthContext here — these routes run through withRateLimit, never
// withAuth (see the route files under src/app/api/manager-invites/**).

export async function handleGetManagerInvitePublic(_req: NextRequest, token: string) {
  const invite = await managerInviteService.getPublicByToken(token);
  return ok(toManagerInvitePublicDto(invite));
}

export async function handleAcceptManagerInvite(req: NextRequest, token: string) {
  const body = acceptManagerInviteSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  const invite = await managerInviteService.accept(
    token,
    { name: body.name, email: body.email, phone: body.phone || undefined, password: body.password },
    meta
  );
  return created({ approvalStatus: invite.approvalStatus });
}
