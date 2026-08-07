import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleListMyPixKeys, handleCreateMyPixKey } from "@/modules/commercial-withdrawals/controllers/commercial-withdraw.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleListMyPixKeys(req, auth)));
export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleCreateMyPixKey(req, auth)));
