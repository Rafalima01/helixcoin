import { createRouteHandler } from "@/server/http";
import { withRole } from "@/server/auth";
import { handleListMyNetwork } from "@/modules/manager/controllers/manager.controller";

export const GET = createRouteHandler(withRole("MANAGER")((req, _ctx, auth) => handleListMyNetwork(req, auth)));
