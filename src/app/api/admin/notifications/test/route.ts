import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleSendTestNotification } from "@/modules/notifications/controllers/notifications-admin.controller";

export const POST = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleSendTestNotification(req, auth)));
