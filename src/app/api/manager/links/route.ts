import { createRouteHandler } from "@/server/http";
import { withRole } from "@/server/auth";
import { handleGetManagerLinks } from "@/modules/manager/controllers/manager.controller";

export const GET = createRouteHandler(withRole("MANAGER")((req, _ctx, auth) => handleGetManagerLinks(req, auth)));
