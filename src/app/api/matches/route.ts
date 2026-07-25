import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleListMyMatches } from "@/modules/match-engine/controllers/match-engine.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleListMyMatches(req, auth)));
