import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleAdjustWallet } from "@/modules/wallet/controllers/wallet-admin.controller";

type Ctx = { params: Promise<{ userId: string }> };

export const POST = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { userId } = await ctx.params;
    return handleAdjustWallet(req, auth, userId);
  })
);
