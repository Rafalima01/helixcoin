import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleZeroDemoBalance } from "@/modules/demo-accounts/controllers/demo-accounts-admin.controller";

type Ctx = { params: Promise<{ id: string }> };

export const POST = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleZeroDemoBalance(req, auth, id);
  })
);
