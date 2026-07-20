import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleRevokeSession } from "@/modules/identity/controllers/session.controller";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = createRouteHandler<Ctx>(
  withAuth<Ctx>(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleRevokeSession(req, auth, id);
  })
);
