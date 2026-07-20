import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListUserLoginHistory } from "@/modules/identity/controllers/user-management.controller";

type Ctx = { params: Promise<{ id: string }> };

export const GET = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleListUserLoginHistory(req, auth, id);
  })
);
