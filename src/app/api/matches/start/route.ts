import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleCreateMatch } from "@/modules/match-engine/controllers/match-engine.controller";

export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleCreateMatch(req, auth)));
