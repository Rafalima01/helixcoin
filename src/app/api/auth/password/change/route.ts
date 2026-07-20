import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleChangePassword } from "@/modules/identity/controllers/password.controller";

export const POST = createRouteHandler(withAuth((req, _ctx, auth) => handleChangePassword(req, auth)));
