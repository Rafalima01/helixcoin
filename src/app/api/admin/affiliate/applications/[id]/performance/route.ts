import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleGetAffiliatePerformanceAdmin } from "@/modules/affiliate/controllers/affiliate-admin.controller";

type Ctx = { params: Promise<{ id: string }> };

export const GET = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleGetAffiliatePerformanceAdmin(req, auth, id);
  })
);
