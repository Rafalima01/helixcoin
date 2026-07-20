import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListPermissionCatalog } from "@/modules/identity/controllers/permission.controller";

export const GET = createRouteHandler(
  withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListPermissionCatalog(req, auth))
);
