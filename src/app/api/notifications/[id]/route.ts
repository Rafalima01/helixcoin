import { createRouteHandler, ok } from "@/server/http";
import { withAuth } from "@/server/auth";
import { NotificationService } from "@/server/notifications";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = createRouteHandler<Ctx>(
  withAuth<Ctx>(async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    await NotificationService.markRead(auth.userId, id);
    return ok({ read: true });
  })
);
