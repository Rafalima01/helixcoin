import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleListMyLinks, handleCreateMyLink } from "@/modules/affiliate/controllers/affiliate.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleListMyLinks(req, auth)));
export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleCreateMyLink(req, auth)));
