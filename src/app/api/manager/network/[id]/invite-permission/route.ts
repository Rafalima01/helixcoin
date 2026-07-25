import { createRouteHandler } from "@/server/http";
import { withRole } from "@/server/auth";
import { handleUpdateNetworkAffiliateInvitePermission } from "@/modules/manager/controllers/manager.controller";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = createRouteHandler<Ctx>(
  withRole<Ctx>("MANAGER")(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleUpdateNetworkAffiliateInvitePermission(req, auth, id);
  })
);
