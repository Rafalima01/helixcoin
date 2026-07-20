import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleListSessions } from "@/modules/identity/controllers/session.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleListSessions(req, auth)));
