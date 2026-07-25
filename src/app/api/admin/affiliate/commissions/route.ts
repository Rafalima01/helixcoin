import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListCommissionsAdmin } from "@/modules/affiliate/controllers/affiliate-admin.controller";

export const GET = createRouteHandler(
  withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListCommissionsAdmin(req, auth))
);
