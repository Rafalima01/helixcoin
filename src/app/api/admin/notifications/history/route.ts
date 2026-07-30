import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListHistoryAdmin } from "@/modules/notifications/controllers/notifications-admin.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListHistoryAdmin(req, auth)));
