import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleRevokeUserSession } from "@/modules/identity/controllers/user-management.controller";

type Ctx = { params: Promise<{ id: string; sessionId: string }> };

export const DELETE = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id, sessionId } = await ctx.params;
    return handleRevokeUserSession(req, auth, id, sessionId);
  })
);
