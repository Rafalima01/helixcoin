import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleActivateManagerAdmin } from "@/modules/manager/controllers/manager.controller";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleActivateManagerAdmin(req, auth, id);
  })
);
