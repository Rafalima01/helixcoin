import type { Queue } from "bullmq";
import { InMemoryPushSubscriptionRepository } from "@/modules/notifications/repositories/push-subscription.in-memory-repository";
import { InMemoryNotificationPreferenceRepository } from "@/modules/notifications/repositories/notification-preference.in-memory-repository";
import { InMemoryPushNotificationLogRepository } from "@/modules/notifications/repositories/push-notification-log.in-memory-repository";
import { InMemoryNotificationRecipientResolver } from "@/modules/notifications/repositories/notification-recipient.in-memory-resolver";
import { NotificationDispatcherService } from "@/modules/notifications/services/notification-dispatcher.service";
import type { PushNotificationJobData } from "@/modules/notifications/queue/notification-queue";

/** Fully-wired NotificationDispatcherService over in-memory repos + a fake BullMQ Queue that just records `.add()` calls — no Redis needed. Mirrors payments' buildPaymentTestHarness() pattern. */
export function buildDispatcherTestHarness() {
  const subscriptions = new InMemoryPushSubscriptionRepository();
  const preferences = new InMemoryNotificationPreferenceRepository();
  const logs = new InMemoryPushNotificationLogRepository();
  const recipients = new InMemoryNotificationRecipientResolver();

  const enqueuedJobs: PushNotificationJobData[] = [];
  const fakeQueue = {
    add: async (_name: string, data: PushNotificationJobData) => {
      enqueuedJobs.push(data);
      return {};
    },
  } as unknown as Queue<PushNotificationJobData>;

  const dispatcher = new NotificationDispatcherService(subscriptions, preferences, logs, recipients, fakeQueue);

  return { subscriptions, preferences, logs, recipients, enqueuedJobs, dispatcher };
}

export async function seedActiveSubscription(subscriptions: InMemoryPushSubscriptionRepository, userId: string, deviceId = "device-1") {
  return subscriptions.upsert({
    userId,
    deviceId,
    endpoint: `https://push.example.com/${userId}/${deviceId}`,
    p256dh: "p256dh-key",
    auth: "auth-key",
  });
}
