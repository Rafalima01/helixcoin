import type { NextRequest } from "next/server";
import { ok, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { AuditService } from "@/server/audit";
import { ForbiddenError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";

const { permissionService } = identityContainer;

export async function handleSearchAudit(req: NextRequest, auth: AuthContext) {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, "audit.read"))) {
    throw new ForbiddenError();
  }

  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const { items, total } = await AuditService.search({
    actorId: url.searchParams.get("actorId") ?? undefined,
    entityType: url.searchParams.get("entityType") ?? undefined,
    entityId: url.searchParams.get("entityId") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(
    items.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    buildPaginationMeta(pagination, total)
  );
}
