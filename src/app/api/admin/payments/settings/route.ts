import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleGetSettingsAdmin, handleUpdateSettingsAdmin } from "@/modules/payments/controllers/payments-admin.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleGetSettingsAdmin(req, auth)));
export const PUT = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleUpdateSettingsAdmin(req, auth)));
