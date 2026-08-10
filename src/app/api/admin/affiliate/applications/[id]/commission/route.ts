import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleUpdateCommissionAdmin } from "@/modules/affiliate/controllers/affiliate-admin.controller";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleUpdateCommissionAdmin(req, auth, id);
  })
);
