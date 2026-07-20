import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleSearchUsers, handleCreateUser } from "@/modules/identity/controllers/user-management.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleSearchUsers(req, auth)));
export const POST = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleCreateUser(req, auth)));
