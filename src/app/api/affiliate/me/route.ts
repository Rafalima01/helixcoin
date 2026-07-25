import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleGetMyAffiliateProfile } from "@/modules/affiliate/controllers/affiliate.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleGetMyAffiliateProfile(req, auth)));
