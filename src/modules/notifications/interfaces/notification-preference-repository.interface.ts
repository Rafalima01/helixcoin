import type { NotificationPreference, NotificationCategory } from "@/modules/notifications/entities/notifications.entity";

/** Service layer depends on this interface only, never on `@/lib/prisma` directly. */
export interface INotificationPreferenceRepository {
  listByUserId(userId: string): Promise<NotificationPreference[]>;
  /** Null means "no override row" — the caller (NotificationPreferenceService) treats that as enabled=true, the default. */
  find(userId: string, category: NotificationCategory): Promise<NotificationPreference | null>;
  upsert(userId: string, category: NotificationCategory, enabled: boolean): Promise<NotificationPreference>;
}
