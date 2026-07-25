import { createRouteHandler } from "@/server/http";
import { withRole } from "@/server/auth";
import { handleGetMyNetworkAffiliate } from "@/modules/manager/controllers/manager.controller";

type Ctx = { params: Promise<{ id: string }> };

export const GET = createRouteHandler<Ctx>(
  withRole<Ctx>("MANAGER")(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleGetMyNetworkAffiliate(req, auth, id);
  })
);
