import { createRouteHandler } from "@/server/http";
import { withRole } from "@/server/auth";
import {
  handleListMyCommercialWithdraws,
  handleRequestManagerWithdraw,
} from "@/modules/commercial-withdrawals/controllers/commercial-withdraw.controller";

export const GET = createRouteHandler(withRole("MANAGER")((req, _ctx, auth) => handleListMyCommercialWithdraws(req, auth)));
export const POST = createRouteHandler(withRole("MANAGER")((req, _ctx, auth) => handleRequestManagerWithdraw(req, auth)));
