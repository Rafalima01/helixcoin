import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListMatchesAdmin } from "@/modules/match-engine/controllers/match-admin.controller";

export const GET = createRouteHandler(
  withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListMatchesAdmin(req, auth))
);
