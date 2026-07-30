import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleDeliveredBeacon } from "@/modules/notifications/controllers/push-beacon.controller";

export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleDeliveredBeacon(req, auth)));
