import type {
  IPushNotificationLogRepository,
  CreatePushNotificationLogInput,
  UpdatePushNotificationLogInput,
  PushNotificationLogListFilter,
} from "@/modules/notifications/interfaces/push-notification-log-repository.interface";
import type { PushNotificationLog } from "@/modules/notifications/entities/notifications.entity";

export class InMemoryPushNotificationLogRepository implements IPushNotificationLogRepository {
  private readonly rows = new Map<string, PushNotificationLog>();

  async create(input: CreatePushNotificationLogInput): Promise<PushNotificationLog> {
    const row: PushNotificationLog = {
      id: crypto.randomUUID(),
      subscriptionId: input.subscriptionId,
      userId: input.userId,
      category: input.category,
      title: input.title,
      body: input.body,
      deepLink: input.deepLink ?? null,
      status: "QUEUED",
      errorMessage: null,
      sentAt: null,
      deliveredAt: null,
      clickedAt: null,
      createdAt: new Date(),
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<PushNotificationLog | null> {
    return this.rows.get(id) ?? null;
  }

  async update(id: string, input: UpdatePushNotificationLogInput): Promise<PushNotificationLog> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`PushNotificationLog ${id} not found`);
    const updated: PushNotificationLog = { ...existing, ...input };
    this.rows.set(id, updated);
    return updated;
  }

  async listAdmin(filter: PushNotificationLogListFilter): Promise<{ items: PushNotificationLog[]; total: number }> {
    let items = [...this.rows.values()];
    if (filter.userId) items = items.filter((r) => r.userId === filter.userId);
    if (filter.category) items = items.filter((r) => r.category === filter.category);
    if (filter.status) items = items.filter((r) => r.status === filter.status);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    return { items: items.slice(start, start + filter.pageSize), total };
  }
}
