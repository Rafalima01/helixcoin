import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleAssignAffiliateManager } from "@/modules/affiliate/controllers/affiliate.controller";

export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleAssignAffiliateManager(req, auth)));
