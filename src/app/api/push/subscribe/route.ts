import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleSubscribe } from "@/modules/notifications/controllers/push-subscription.controller";

export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleSubscribe(req, auth)));
