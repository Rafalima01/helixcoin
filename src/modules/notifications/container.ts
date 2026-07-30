import { PrismaPushSubscriptionRepository } from "@/modules/notifications/repositories/push-subscription.prisma-repository";
import { PrismaNotificationPreferenceRepository } from "@/modules/notifications/repositories/notification-preference.prisma-repository";
import { PrismaPushNotificationLogRepository } from "@/modules/notifications/repositories/push-notification-log.prisma-repository";
import { PrismaNotificationRecipientResolver } from "@/modules/notifications/repositories/notification-recipient.prisma-resolver";
import { createPushNotificationsQueue } from "@/modules/notifications/queue/notification-queue";
import { NotificationDispatcherService } from "@/modules/notifications/services/notification-dispatcher.service";
import { PushSubscriptionService } from "@/modules/notifications/services/push-subscription.service";
import { NotificationPreferenceService } from "@/modules/notifications/services/notification-preference.service";
import { NotificationHistoryService } from "@/modules/notifications/services/notification-history.service";
import { DailySummaryService } from "@/modules/notifications/services/daily-summary.service";

const subscriptions = new PrismaPushSubscriptionRepository();
const preferences = new PrismaNotificationPreferenceRepository();
const logs = new PrismaPushNotificationLogRepository();
const recipients = new PrismaNotificationRecipientResolver();
const pushQueue = createPushNotificationsQueue();

const notificationDispatcher = new NotificationDispatcherService(subscriptions, preferences, logs, recipients, pushQueue);

// Wires the dispatcher to the existing payments/affiliate/manager domain
// events exactly once, at module load — same convention as
// affiliateContainer's commissionService.subscribeToDeposits(). Only runs in
// the web process (where these events are actually published); the
// standalone worker process never imports this container, only
// notification-queue.ts's worker-side exports (see scripts/worker.ts).
notificationDispatcher.subscribeToEvents();

export const notificationsContainer = {
  notificationDispatcher,
  pushSubscriptionService: new PushSubscriptionService(subscriptions),
  notificationPreferenceService: new NotificationPreferenceService(preferences),
  notificationHistoryService: new NotificationHistoryService(logs),
  dailySummaryService: new DailySummaryService(),
  pushSubscriptionRepository: subscriptions,
};
