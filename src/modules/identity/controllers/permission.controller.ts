import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";

const { permissionService } = identityContainer;

async function assertCanReadPermissions(auth: AuthContext): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, "permissions.read"))) {
    throw new ForbiddenError();
  }
}

export async function handleListPermissionCatalog(_req: NextRequest, auth: AuthContext) {
  await assertCanReadPermissions(auth);
  const catalog = await permissionService.listCatalog();
  return ok(catalog);
}

export async function handleListRoleGrants(_req: NextRequest, auth: AuthContext) {
  await assertCanReadPermissions(auth);
  const grants = await permissionService.listAllGrants();
  return ok(grants);
}
