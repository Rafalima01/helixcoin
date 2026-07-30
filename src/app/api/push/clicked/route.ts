import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleClickedBeacon } from "@/modules/notifications/controllers/push-beacon.controller";

export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleClickedBeacon(req, auth)));
