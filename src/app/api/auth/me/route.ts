import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleMe } from "@/modules/identity/controllers/auth.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleMe(req, auth)));
