import type { INotificationPreferenceRepository } from "@/modules/notifications/interfaces/notification-preference-repository.interface";
import type { NotificationPreference, NotificationCategory } from "@/modules/notifications/entities/notifications.entity";

export class InMemoryNotificationPreferenceRepository implements INotificationPreferenceRepository {
  private readonly rows = new Map<string, NotificationPreference>();

  private key(userId: string, category: NotificationCategory): string {
    return `${userId}:${category}`;
  }

  async listByUserId(userId: string): Promise<NotificationPreference[]> {
    return [...this.rows.values()].filter((r) => r.userId === userId);
  }

  async find(userId: string, category: NotificationCategory): Promise<NotificationPreference | null> {
    return this.rows.get(this.key(userId, category)) ?? null;
  }

  async upsert(userId: string, category: NotificationCategory, enabled: boolean): Promise<NotificationPreference> {
    const k = this.key(userId, category);
    const existing = this.rows.get(k);
    const row: NotificationPreference = existing
      ? { ...existing, enabled, updatedAt: new Date() }
      : { id: crypto.randomUUID(), userId, category, enabled, updatedAt: new Date() };
    this.rows.set(k, row);
    return row;
  }
}
