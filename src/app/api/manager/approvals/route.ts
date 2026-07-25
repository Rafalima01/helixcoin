import { createRouteHandler } from "@/server/http";
import { withRole } from "@/server/auth";
import { handleListApprovals } from "@/modules/manager/controllers/manager.controller";

export const GET = createRouteHandler(withRole("MANAGER")((req, _ctx, auth) => handleListApprovals(req, auth)));
