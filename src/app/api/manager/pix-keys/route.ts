import { createRouteHandler } from "@/server/http";
import { withRole } from "@/server/auth";
import { handleListMyPixKeys, handleCreateMyPixKey } from "@/modules/commercial-withdrawals/controllers/commercial-withdraw.controller";

export const GET = createRouteHandler(withRole("MANAGER")((req, _ctx, auth) => handleListMyPixKeys(req, auth)));
export const POST = createRouteHandler(withRole("MANAGER")((req, _ctx, auth) => handleCreateMyPixKey(req, auth)));
