import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleRestoreUser } from "@/modules/identity/controllers/user-management.controller";

type Ctx = { params: Promise<{ id: string }> };

export const POST = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleRestoreUser(req, auth, id);
  })
);
