import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import {
  handleGetAffiliateSettingsAdmin,
  handleUpdateAffiliateSettingsAdmin,
} from "@/modules/affiliate/controllers/affiliate-admin.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleGetAffiliateSettingsAdmin(req, auth)));
export const PUT = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleUpdateAffiliateSettingsAdmin(req, auth)));
