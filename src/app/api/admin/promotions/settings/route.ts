import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import {
  handleGetPromotionSettingsAdmin,
  handleUpdatePromotionSettingsAdmin,
} from "@/modules/promotions/controllers/promotions-admin.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleGetPromotionSettingsAdmin(req, auth)));
export const PUT = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleUpdatePromotionSettingsAdmin(req, auth)));
