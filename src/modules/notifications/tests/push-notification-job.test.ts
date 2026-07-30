import { describe, expect, it, vi } from "vitest";
import { InMemoryPushSubscriptionRepository } from "@/modules/notifications/repositories/push-subscription.in-memory-repository";
import { InMemoryPushNotificationLogRepository } from "@/modules/notifications/repositories/push-notification-log.in-memory-repository";
import { processPushNotificationJob } from "@/modules/notifications/queue/notification-queue";
import type { PushProvider, PushSendResult } from "@/modules/notifications/interfaces/push-provider.interface";

function fakeProvider(result: PushSendResult): PushProvider {
  return {
    name: "WEB_PUSH",
    send: vi.fn().mockResolvedValue(result),
    sendMany: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    validateToken: vi.fn(),
    healthCheck: vi.fn(),
  };
}

const BASE_PAYLOAD = { title: "t", body: "b", icon: "i", deepLink: "d", priority: "normal" as const, category: "DEPOSIT_CONFIRMED" };

describe("processPushNotificationJob (queue worker logic)", () => {
  it("a successful send marks the log SENT", async () => {
    const subscriptions = new InMemoryPushSubscriptionRepository();
    const logs = new InMemoryPushNotificationLogRepository();
    const subscription = await subscriptions.upsert({ userId: "u1", deviceId: "d1", endpoint: "https://x", p256dh: "p", auth: "a" });
    const log = await logs.create({ subscriptionId: subscription.id, userId: "u1", category: "DEPOSIT_CONFIRMED", title: "t", body: "b" });

    const provider = fakeProvider({ success: true });
    await processPushNotificationJob(
      { subscriptions, logs, resolveProvider: () => provider },
      { subscriptionId: subscription.id, payload: { ...BASE_PAYLOAD, logId: log.id } }
    );

    expect((await logs.findById(log.id))?.status).toBe("SENT");
    expect(provider.send).toHaveBeenCalledTimes(1);
  });

  it("a failed send (not expired) marks the log FAILED and keeps the subscription ACTIVE", async () => {
    const subscriptions = new InMemoryPushSubscriptionRepository();
    const logs = new InMemoryPushNotificationLogRepository();
    const subscription = await subscriptions.upsert({ userId: "u1", deviceId: "d1", endpoint: "https://x", p256dh: "p", auth: "a" });
    const log = await logs.create({ subscriptionId: subscription.id, userId: "u1", category: "DEPOSIT_CONFIRMED", title: "t", body: "b" });

    const provider = fakeProvider({ success: false, errorMessage: "network error" });
    await processPushNotificationJob(
      { subscriptions, logs, resolveProvider: () => provider },
      { subscriptionId: subscription.id, payload: { ...BASE_PAYLOAD, logId: log.id } }
    );

    const updatedLog = await logs.findById(log.id);
    expect(updatedLog?.status).toBe("FAILED");
    expect(updatedLog?.errorMessage).toBe("network error");
    expect((await subscriptions.findById(subscription.id))?.status).toBe("ACTIVE");
  });

  it("a failed send with expired:true also flips the subscription to EXPIRED (404/410 self-healing)", async () => {
    const subscriptions = new InMemoryPushSubscriptionRepository();
    const logs = new InMemoryPushNotificationLogRepository();
    const subscription = await subscriptions.upsert({ userId: "u1", deviceId: "d1", endpoint: "https://x", p256dh: "p", auth: "a" });
    const log = await logs.create({ subscriptionId: subscription.id, userId: "u1", category: "DEPOSIT_CONFIRMED", title: "t", body: "b" });

    const provider = fakeProvider({ success: false, expired: true, errorMessage: "gone" });
    await processPushNotificationJob(
      { subscriptions, logs, resolveProvider: () => provider },
      { subscriptionId: subscription.id, payload: { ...BASE_PAYLOAD, logId: log.id } }
    );

    expect((await subscriptions.findById(subscription.id))?.status).toBe("EXPIRED");
  });

  it("a job for a non-ACTIVE subscription never calls the provider", async () => {
    const subscriptions = new InMemoryPushSubscriptionRepository();
    const logs = new InMemoryPushNotificationLogRepository();
    const subscription = await subscriptions.upsert({ userId: "u1", deviceId: "d1", endpoint: "https://x", p256dh: "p", auth: "a" });
    await subscriptions.updateStatus(subscription.id, "REVOKED");
    const log = await logs.create({ subscriptionId: subscription.id, userId: "u1", category: "DEPOSIT_CONFIRMED", title: "t", body: "b" });

    const provider = fakeProvider({ success: true });
    await processPushNotificationJob(
      { subscriptions, logs, resolveProvider: () => provider },
      { subscriptionId: subscription.id, payload: { ...BASE_PAYLOAD, logId: log.id } }
    );

    expect(provider.send).not.toHaveBeenCalled();
    expect((await logs.findById(log.id))?.status).toBe("QUEUED"); // untouched
  });

  it("a job for a missing subscription never throws", async () => {
    const subscriptions = new InMemoryPushSubscriptionRepository();
    const logs = new InMemoryPushNotificationLogRepository();
    const provider = fakeProvider({ success: true });

    await expect(
      processPushNotificationJob(
        { subscriptions, logs, resolveProvider: () => provider },
        { subscriptionId: "does-not-exist", payload: { ...BASE_PAYLOAD, logId: "log-x" } }
      )
    ).resolves.toBeUndefined();
    expect(provider.send).not.toHaveBeenCalled();
  });
});
