import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import {
  handleListApplicationsAdmin,
  handleCreateDirectAffiliateAdmin,
} from "@/modules/affiliate/controllers/affiliate-admin.controller";

export const GET = createRouteHandler(
  withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListApplicationsAdmin(req, auth))
);

export const POST = createRouteHandler(
  withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleCreateDirectAffiliateAdmin(req, auth))
);
