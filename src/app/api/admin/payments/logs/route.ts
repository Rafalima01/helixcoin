import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListGatewayLogsAdmin } from "@/modules/payments/controllers/payments-admin.controller";

export const GET = createRouteHandler(
  withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListGatewayLogsAdmin(req, auth))
);
