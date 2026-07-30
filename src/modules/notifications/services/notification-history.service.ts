import { NotFoundError } from "@/server/errors";
import type { IPushNotificationLogRepository, PushNotificationLogListFilter } from "@/modules/notifications/interfaces/push-notification-log-repository.interface";
import type { PushNotificationLog } from "@/modules/notifications/entities/notifications.entity";

export class NotificationHistoryService {
  constructor(private readonly logs: IPushNotificationLogRepository) {}

  async listAdmin(filter: PushNotificationLogListFilter) {
    return this.logs.listAdmin(filter);
  }

  async getAdmin(id: string): Promise<PushNotificationLog> {
    const log = await this.logs.findById(id);
    if (!log) throw new NotFoundError("Notificação");
    return log;
  }

  /** Fired by the Service Worker's `push` handler beacon — only advances SENT -> DELIVERED, never downgrades an already-CLICKED row. */
  async markDelivered(logId: string): Promise<void> {
    const log = await this.logs.findById(logId);
    if (!log || log.status !== "SENT") return;
    await this.logs.update(logId, { status: "DELIVERED", deliveredAt: new Date() });
  }

  /** Fired by the Service Worker's `notificationclick` handler beacon — terminal, also backfills deliveredAt if the delivered beacon never landed. */
  async markClicked(logId: string): Promise<void> {
    const log = await this.logs.findById(logId);
    if (!log) return;
    await this.logs.update(logId, { status: "CLICKED", clickedAt: new Date(), deliveredAt: log.deliveredAt ?? new Date() });
  }
}
