import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleRevokeAllSessions } from "@/modules/identity/controllers/session.controller";

export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleRevokeAllSessions(req, auth)));
