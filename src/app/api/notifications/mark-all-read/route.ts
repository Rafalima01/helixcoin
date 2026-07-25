import { createRouteHandler, ok } from "@/server/http";
import { withAuth } from "@/server/auth";
import { NotificationService } from "@/server/notifications";

export const POST = createRouteHandler(
  withAuth(async (_req, _ctx, auth) => {
    await NotificationService.markAllRead(auth.userId);
    return ok({ read: true });
  })
);
