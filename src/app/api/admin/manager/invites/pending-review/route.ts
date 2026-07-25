import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListPendingApprovalsAdmin } from "@/modules/manager/controllers/manager-invite.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListPendingApprovalsAdmin(req, auth)));
