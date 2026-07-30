import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleUnsubscribe } from "@/modules/notifications/controllers/push-subscription.controller";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = createRouteHandler<Ctx>(
  withAuth<Ctx>(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleUnsubscribe(req, auth, id);
  })
);
