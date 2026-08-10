import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleGetAffiliateByUserIdAdmin } from "@/modules/affiliate/controllers/affiliate-admin.controller";

type Ctx = { params: Promise<{ userId: string }> };

export const GET = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { userId } = await ctx.params;
    return handleGetAffiliateByUserIdAdmin(req, auth, userId);
  })
);
