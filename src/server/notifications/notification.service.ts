import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createChildLogger } from "@/server/logger";

const logger = createChildLogger({ module: "notifications" });

/**
 * Central de Notificações (Phase 8) — thin wrapper over the `Notification`
 * model, which has existed since Phase 2 but was read-only until now (see
 * src/app/api/notifications/route.ts). No email/push integration this
 * phase, per spec — this is the notification CENTER only.
 */
export const NOTIFICATION_TYPES = {
  newSignup: "new_signup",
  newAffiliate: "new_affiliate",
  newFtd: "new_ftd",
  newCommission: "new_commission",
  withdrawApproved: "withdraw_approved",
  withdrawRejected: "withdraw_rejected",
  documentsPending: "documents_pending",
  accountApproved: "account_approved",
  accountBlocked: "account_blocked",
  system: "system",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
}

export interface NotificationListFilter {
  userId: string;
  unreadOnly?: boolean;
  page: number;
  pageSize: number;
}

/**
 * `notify()` must never fail the operation that triggered it — same
 * fire-and-forget-on-error convention as AuditService.record (see
 * src/server/audit/audit.service.ts). Every mutating affiliate/manager
 * service call ends with one of these, exactly like it ends with an
 * AuditService.record call.
 */
export const NotificationService = {
  async notify(input: NotifyInput): Promise<void> {
    try {
      await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.message,
        },
      });
    } catch (err) {
      logger.error({ err, type: input.type, userId: input.userId }, "Failed to write notification");
    }
  },

  async listForUser(filter: NotificationListFilter) {
    const where: Prisma.NotificationWhereInput = {
      userId: filter.userId,
      ...(filter.unreadOnly ? { read: false } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: filter.userId, read: false } }),
    ]);

    return { items, total, unreadCount };
  },

  async markRead(userId: string, id: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  },

  async markAllRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  },
};
