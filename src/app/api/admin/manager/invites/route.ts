import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListManagerInvitesAdmin, handleCreateManagerInviteAdmin } from "@/modules/manager/controllers/manager-invite.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListManagerInvitesAdmin(req, auth)));
export const POST = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleCreateManagerInviteAdmin(req, auth)));
