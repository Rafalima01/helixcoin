import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListApplicationsAdmin } from "@/modules/affiliate/controllers/affiliate-admin.controller";

export const GET = createRouteHandler(
  withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListApplicationsAdmin(req, auth))
);
