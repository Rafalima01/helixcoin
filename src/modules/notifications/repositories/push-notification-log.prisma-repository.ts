import { Prisma } from "@prisma/client";
import type { PushNotificationLog as PrismaPushNotificationLog } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IPushNotificationLogRepository,
  CreatePushNotificationLogInput,
  UpdatePushNotificationLogInput,
  PushNotificationLogListFilter,
} from "@/modules/notifications/interfaces/push-notification-log-repository.interface";
import type { PushNotificationLog } from "@/modules/notifications/entities/notifications.entity";

function toEntity(row: PrismaPushNotificationLog): PushNotificationLog {
  return {
    id: row.id,
    subscriptionId: row.subscriptionId,
    userId: row.userId,
    category: row.category,
    title: row.title,
    body: row.body,
    deepLink: row.deepLink,
    status: row.status,
    errorMessage: row.errorMessage,
    sentAt: row.sentAt,
    deliveredAt: row.deliveredAt,
    clickedAt: row.clickedAt,
    createdAt: row.createdAt,
  };
}

export class PrismaPushNotificationLogRepository implements IPushNotificationLogRepository {
  async create(input: CreatePushNotificationLogInput): Promise<PushNotificationLog> {
    const row = await prisma.pushNotificationLog.create({
      data: {
        subscriptionId: input.subscriptionId,
        userId: input.userId,
        category: input.category,
        title: input.title,
        body: input.body,
        deepLink: input.deepLink ?? null,
      },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<PushNotificationLog | null> {
    const row = await prisma.pushNotificationLog.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async update(id: string, input: UpdatePushNotificationLogInput): Promise<PushNotificationLog> {
    const row = await prisma.pushNotificationLog.update({ where: { id }, data: input });
    return toEntity(row);
  }

  async listAdmin(filter: PushNotificationLogListFilter): Promise<{ items: PushNotificationLog[]; total: number }> {
    const where: Prisma.PushNotificationLogWhereInput = {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.category ? { category: filter.category } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.pushNotificationLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.pushNotificationLog.count({ where }),
    ]);

    return { items: rows.map(toEntity), total };
  }
}
