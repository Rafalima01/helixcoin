import { createRouteHandler } from "@/server/http";
import { withRole } from "@/server/auth";
import { handleDecideApproval } from "@/modules/manager/controllers/manager.controller";

type Ctx = { params: Promise<{ id: string }> };

export const POST = createRouteHandler<Ctx>(
  withRole<Ctx>("MANAGER")(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleDecideApproval(req, auth, id);
  })
);
