import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleLogout } from "@/modules/identity/controllers/auth.controller";

export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleLogout(req, auth)));
