import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import {
  handleListMyCommercialWithdraws,
  handleRequestAffiliateWithdraw,
} from "@/modules/commercial-withdrawals/controllers/commercial-withdraw.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleListMyCommercialWithdraws(req, auth)));
export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleRequestAffiliateWithdraw(req, auth)));
