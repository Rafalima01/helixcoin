import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleApplyAffiliate } from "@/modules/affiliate/controllers/affiliate.controller";

export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleApplyAffiliate(req, auth)));
