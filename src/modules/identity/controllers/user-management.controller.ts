import type { NextRequest } from "next/server";
import { ok, created, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { extractRequestMeta } from "@/server/audit";
import { ForbiddenError } from "@/server/errors";
import { userSearchSchema, createUserSchema, updateUserSchema } from "@/modules/identity/validators/user.validator";
import { toUserResponseDto } from "@/modules/identity/dto/user.dto";
import { toSessionResponseDto } from "@/modules/identity/dto/session.dto";
import { identityContainer } from "@/modules/identity/container";

const { userManagementService, permissionService } = identityContainer;

async function assertPermission(auth: AuthContext, key: string): Promise<void> {
  if (!auth.role) throw new ForbiddenError();
  if (!(await permissionService.hasPermission(auth.role, key))) throw new ForbiddenError();
}

export async function handleSearchUsers(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "users.read");

  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = userSearchSchema.parse({
    search: url.searchParams.get("search") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    emailVerified: url.searchParams.get("emailVerified") ?? undefined,
    phoneVerified: url.searchParams.get("phoneVerified") ?? undefined,
    mfaEnabled: url.searchParams.get("mfaEnabled") ?? undefined,
    locked: url.searchParams.get("locked") ?? undefined,
    createdFrom: url.searchParams.get("createdFrom") ?? undefined,
    createdTo: url.searchParams.get("createdTo") ?? undefined,
    includeDeleted: url.searchParams.get("includeDeleted") ?? undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
    sort: url.searchParams.get("sort") ?? undefined,
    order: url.searchParams.get("order") ?? undefined,
  });

  const { items, total } = await userManagementService.search(query);
  return ok(
    items.map((u) => toUserResponseDto(u)),
    buildPaginationMeta(pagination, total)
  );
}

export async function handleGetUser(_req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth, "users.read");
  const user = await userManagementService.getById(userId);
  return ok(toUserResponseDto(user));
}

export async function handleCreateUser(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "users.create");
  const body = createUserSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  const user = await userManagementService.create(body, { id: auth.userId, role: auth.role! }, meta);
  return created(toUserResponseDto(user));
}

export async function handleUpdateUser(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth, "users.update");
  const body = updateUserSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  const user = await userManagementService.update(userId, body, { id: auth.userId, role: auth.role! }, meta);
  return ok(toUserResponseDto(user));
}

export async function handleBlockUser(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth, "users.block");
  const body = await req.json().catch(() => ({}));
  const meta = extractRequestMeta(req);
  await userManagementService.block(userId, { id: auth.userId, role: auth.role! }, meta, body?.reason);
  return ok({});
}

export async function handleUnblockUser(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth, "users.block");
  const meta = extractRequestMeta(req);
  await userManagementService.unblock(userId, { id: auth.userId, role: auth.role! }, meta);
  return ok({});
}

export async function handleSoftDeleteUser(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth, "users.delete");
  const meta = extractRequestMeta(req);
  await userManagementService.softDelete(userId, { id: auth.userId, role: auth.role! }, meta);
  return ok({});
}

export async function handleRestoreUser(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth, "users.restore");
  const meta = extractRequestMeta(req);
  await userManagementService.restore(userId, { id: auth.userId, role: auth.role! }, meta);
  return ok({});
}

export async function handleListUserSessions(_req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth, "sessions.read");
  const sessions = await identityContainer.sessionService.listSessions(userId);
  return ok(sessions.map((s) => toSessionResponseDto(s, null)));
}

export async function handleListUserLoginHistory(req: NextRequest, auth: AuthContext, userId: string) {
  await assertPermission(auth, "users.read");
  const pagination = parsePagination(req.nextUrl.searchParams);
  const result = await identityContainer.loginHistoryService.listForUser(userId, pagination);
  return ok(result.items, buildPaginationMeta(pagination, result.total));
}

export async function handleRevokeUserSession(
  req: NextRequest,
  auth: AuthContext,
  userId: string,
  sessionId: string
) {
  await assertPermission(auth, "sessions.revoke");
  const meta = extractRequestMeta(req);
  await identityContainer.sessionService.revokeSession(userId, sessionId, meta);
  return ok({});
}
