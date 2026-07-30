import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleListMyDevices } from "@/modules/notifications/controllers/push-subscription.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleListMyDevices(req, auth)));
