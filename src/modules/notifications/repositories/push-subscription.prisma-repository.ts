import { prisma } from "@/lib/prisma";
import type { PushSubscription as PrismaPushSubscription } from "@prisma/client";
import type { IPushSubscriptionRepository, UpsertPushSubscriptionInput } from "@/modules/notifications/interfaces/push-subscription-repository.interface";
import type { PushSubscription, PushSubscriptionStatus } from "@/modules/notifications/entities/notifications.entity";

function toEntity(row: PrismaPushSubscription): PushSubscription {
  return {
    id: row.id,
    userId: row.userId,
    deviceId: row.deviceId,
    browser: row.browser,
    os: row.os,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaPushSubscriptionRepository implements IPushSubscriptionRepository {
  async upsert(input: UpsertPushSubscriptionInput): Promise<PushSubscription> {
    const row = await prisma.pushSubscription.upsert({
      where: { userId_deviceId: { userId: input.userId, deviceId: input.deviceId } },
      create: {
        userId: input.userId,
        deviceId: input.deviceId,
        browser: input.browser ?? null,
        os: input.os ?? null,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        status: "ACTIVE",
      },
      update: {
        browser: input.browser ?? null,
        os: input.os ?? null,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        status: "ACTIVE",
      },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<PushSubscription | null> {
    const row = await prisma.pushSubscription.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findActiveByUserId(userId: string): Promise<PushSubscription[]> {
    const rows = await prisma.pushSubscription.findMany({ where: { userId, status: "ACTIVE" } });
    return rows.map(toEntity);
  }

  async listByUserId(userId: string): Promise<PushSubscription[]> {
    const rows = await prisma.pushSubscription.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    return rows.map(toEntity);
  }

  async updateStatus(id: string, status: PushSubscriptionStatus): Promise<PushSubscription> {
    const row = await prisma.pushSubscription.update({ where: { id }, data: { status } });
    return toEntity(row);
  }
}
