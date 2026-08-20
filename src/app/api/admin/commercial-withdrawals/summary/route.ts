import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleGetCommercialWithdrawalsSummaryAdmin } from "@/modules/commercial-withdrawals/controllers/commercial-withdraw.controller";

export const GET = createRouteHandler(
  withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleGetCommercialWithdrawalsSummaryAdmin(req, auth))
);
