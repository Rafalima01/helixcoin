import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleCreateDeposit } from "@/modules/payments/controllers/payments.controller";

export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleCreateDeposit(req, auth)));
