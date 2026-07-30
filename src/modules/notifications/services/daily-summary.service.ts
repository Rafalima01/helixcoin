import { prisma } from "@/lib/prisma";
import { eventBus } from "@/server/events";
import { DAILY_SUMMARY_EVENTS } from "@/modules/notifications/events/notifications.events";

function todayRangeUtc(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Report generation, not business logic — read-only aggregation directly
 * against Prisma (same "cross-cutting report" allowance the admin
 * dashboard/analytics screens already rely on). Triggered once a day
 * (23:59) by the repeatable BullMQ job registered in scripts/worker.ts.
 * Publishes DAILY_SUMMARY_EVENTS.generated — NotificationDispatcher already
 * knows how to turn that into an admin broadcast push, no special-casing
 * needed here.
 */
export class DailySummaryService {
  async buildAndPublish(): Promise<void> {
    const { start, end } = todayRangeUtc();

    const [depositsAgg, withdrawsAgg, newPlayers, newAffiliates, newManagers] = await Promise.all([
      prisma.deposit.aggregate({ where: { status: "PAID", confirmedAt: { gte: start, lt: end } }, _sum: { amountCents: true } }),
      prisma.withdraw.aggregate({ where: { status: "APPROVED", processedAt: { gte: start, lt: end } }, _sum: { amountCents: true } }),
      prisma.user.count({ where: { role: "USER", createdAt: { gte: start, lt: end } } }),
      prisma.affiliateProfile.count({ where: { requestedAt: { gte: start, lt: end } } }),
      prisma.managerProfile.count({ where: { createdAt: { gte: start, lt: end } } }),
    ]);

    eventBus.publish(DAILY_SUMMARY_EVENTS.generated, {
      depositsTotalCents: depositsAgg._sum.amountCents ?? 0,
      withdrawsTotalCents: withdrawsAgg._sum.amountCents ?? 0,
      newPlayers,
      newAffiliates,
      newManagers,
    });
  }
}
