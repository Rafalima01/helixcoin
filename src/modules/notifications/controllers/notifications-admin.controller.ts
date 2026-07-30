import type { NextRequest } from "next/server";
import { ok, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { notificationsContainer } from "@/modules/notifications/container";
import { adminHistoryListQuerySchema } from "@/modules/notifications/validators/notifications.validator";
import { toPushNotificationLogDto } from "@/modules/notifications/dto/notifications.dto";
import type { NotificationCategory, PushDeliveryStatus } from "@/modules/notifications/entities/notifications.entity";

const { notificationHistoryService, notificationDispatcher } = notificationsContainer;
const { permissionService } = identityContainer;

async function assertPermission(auth: AuthContext, key: "notifications.read" | "notifications.manage"): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, key))) {
    throw new ForbiddenError();
  }
}

export async function handleListHistoryAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "notifications.read");
  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminHistoryListQuerySchema.parse({
    userId: url.searchParams.get("userId") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });

  const { items, total } = await notificationHistoryService.listAdmin({
    userId: query.userId,
    category: query.category as NotificationCategory | undefined,
    status: query.status as PushDeliveryStatus | undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toPushNotificationLogDto), buildPaginationMeta(pagination, total));
}

export async function handleGetHistoryAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "notifications.read");
  const log = await notificationHistoryService.getAdmin(id);
  return ok(toPushNotificationLogDto(log));
}

/** "Enviar Notificação de Teste" button — always targets `auth.userId` (the logged-in admin), never a broadcast; goes through the exact same dispatcher/queue/provider/log path every other category uses. */
export async function handleSendTestNotification(_req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "notifications.manage");
  await notificationDispatcher.sendTestNotification(auth.userId);
  return ok({ sent: true });
}
