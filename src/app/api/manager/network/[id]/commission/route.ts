import { createRouteHandler } from "@/server/http";
import { withRole } from "@/server/auth";
import { handleUpdateNetworkAffiliateCommission } from "@/modules/manager/controllers/manager.controller";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = createRouteHandler<Ctx>(
  withRole<Ctx>("MANAGER")(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleUpdateNetworkAffiliateCommission(req, auth, id);
  })
);
