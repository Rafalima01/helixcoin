import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListGatewaysAdmin, handleCreateGatewayAdmin } from "@/modules/payments/controllers/payments-admin.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListGatewaysAdmin(req, auth)));
export const POST = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleCreateGatewayAdmin(req, auth)));
