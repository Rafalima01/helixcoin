import type { Queue, Job } from "bullmq";
import { createQueue, createWorker, QUEUE_NAMES } from "@/server/queue";
import { createChildLogger } from "@/server/logger";
import { PrismaPushSubscriptionRepository } from "@/modules/notifications/repositories/push-subscription.prisma-repository";
import { PrismaPushNotificationLogRepository } from "@/modules/notifications/repositories/push-notification-log.prisma-repository";
import { PushProviderFactory } from "@/modules/notifications/factories/push-provider.factory";
import type { PushPayload, PushProvider } from "@/modules/notifications/interfaces/push-provider.interface";
import type { IPushSubscriptionRepository } from "@/modules/notifications/interfaces/push-subscription-repository.interface";
import type { IPushNotificationLogRepository } from "@/modules/notifications/interfaces/push-notification-log-repository.interface";

const logger = createChildLogger({ module: "notifications.queue" });

export interface PushNotificationJobData {
  subscriptionId: string;
  payload: PushPayload;
}

/** Producer side — called by NotificationDispatcher (web process), never sends anything itself. */
export function createPushNotificationsQueue(): Queue<PushNotificationJobData> {
  return createQueue<PushNotificationJobData>(QUEUE_NAMES.pushNotifications);
}

/**
 * The actual job logic, factored out of the BullMQ processor so it's
 * testable with in-memory repos + a fake provider (no Redis/Worker needed).
 * Deliberately dumb: takes a subscriptionId + an already-built payload
 * (including the PushNotificationLog id to update), resolves the provider,
 * sends, records the outcome. All recipient/preference resolution already
 * happened in the dispatcher before this job was ever enqueued.
 */
export async function processPushNotificationJob(
  deps: { subscriptions: IPushSubscriptionRepository; logs: IPushNotificationLogRepository; resolveProvider: (platform: "WEB_PUSH") => PushProvider },
  data: PushNotificationJobData
): Promise<void> {
  const { subscriptionId, payload } = data;

  const subscription = await deps.subscriptions.findById(subscriptionId);
  if (!subscription) {
    logger.warn({ subscriptionId, logId: payload.logId }, "push job for missing subscription, skipping");
    return;
  }
  if (subscription.status !== "ACTIVE") {
    logger.info({ subscriptionId, status: subscription.status }, "push job for non-active subscription, skipping");
    return;
  }

  const provider = deps.resolveProvider("WEB_PUSH");
  const result = await provider.send(subscription, payload);

  if (result.success) {
    await deps.logs.update(payload.logId, { status: "SENT", sentAt: new Date() });
  } else {
    await deps.logs.update(payload.logId, { status: "FAILED", errorMessage: result.errorMessage ?? "unknown error" });
    if (result.expired) {
      await deps.subscriptions.updateStatus(subscriptionId, "EXPIRED");
    }
  }
}

/** Consumer side — runs in the standalone worker process (scripts/worker.ts). Real Prisma repos + the real provider factory; see processPushNotificationJob for the testable logic. */
export function startPushNotificationsWorker() {
  const subscriptions = new PrismaPushSubscriptionRepository();
  const logs = new PrismaPushNotificationLogRepository();

  return createWorker<PushNotificationJobData>(
    QUEUE_NAMES.pushNotifications,
    async (job: Job<PushNotificationJobData>) => {
      await processPushNotificationJob({ subscriptions, logs, resolveProvider: PushProviderFactory.forPlatform }, job.data);
    },
    { concurrency: 10, deadLetterQueue: QUEUE_NAMES.deadLetter }
  );
}

/** Repeatable (23:59 daily) — the queue only carries a trigger, no payload; the handler (DailySummaryService.buildAndPublish, wired in scripts/worker.ts) does the aggregation. */
export function createDailySummaryQueue(): Queue<Record<string, never>> {
  return createQueue<Record<string, never>>(QUEUE_NAMES.dailySummary);
}

export function startDailySummaryWorker(onTrigger: () => Promise<void>) {
  return createWorker<Record<string, never>>(
    QUEUE_NAMES.dailySummary,
    async () => {
      await onTrigger();
    },
    { concurrency: 1, deadLetterQueue: QUEUE_NAMES.deadLetter }
  );
}
