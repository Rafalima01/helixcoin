import { prisma } from "@/lib/prisma";
import type { NotificationPreference as PrismaNotificationPreference } from "@prisma/client";
import type { INotificationPreferenceRepository } from "@/modules/notifications/interfaces/notification-preference-repository.interface";
import type { NotificationPreference, NotificationCategory } from "@/modules/notifications/entities/notifications.entity";

function toEntity(row: PrismaNotificationPreference): NotificationPreference {
  return { id: row.id, userId: row.userId, category: row.category, enabled: row.enabled, updatedAt: row.updatedAt };
}

export class PrismaNotificationPreferenceRepository implements INotificationPreferenceRepository {
  async listByUserId(userId: string): Promise<NotificationPreference[]> {
    const rows = await prisma.notificationPreference.findMany({ where: { userId } });
    return rows.map(toEntity);
  }

  async find(userId: string, category: NotificationCategory): Promise<NotificationPreference | null> {
    const row = await prisma.notificationPreference.findUnique({ where: { userId_category: { userId, category } } });
    return row ? toEntity(row) : null;
  }

  async upsert(userId: string, category: NotificationCategory, enabled: boolean): Promise<NotificationPreference> {
    const row = await prisma.notificationPreference.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, category, enabled },
      update: { enabled },
    });
    return toEntity(row);
  }
}
