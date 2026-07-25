import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleListMyCommissions } from "@/modules/affiliate/controllers/affiliate.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleListMyCommissions(req, auth)));
