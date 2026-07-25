import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleGetAffiliateDashboard } from "@/modules/affiliate/controllers/affiliate.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleGetAffiliateDashboard(req, auth)));
