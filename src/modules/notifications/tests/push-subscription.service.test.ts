import { describe, expect, it } from "vitest";
import { InMemoryPushSubscriptionRepository } from "@/modules/notifications/repositories/push-subscription.in-memory-repository";
import { PushSubscriptionService } from "@/modules/notifications/services/push-subscription.service";
import type { SubscribeInput } from "@/modules/notifications/validators/notifications.validator";

function input(deviceId: string): SubscribeInput {
  return {
    deviceId,
    browser: "Chrome",
    os: "Windows",
    endpoint: `https://push.example.com/${deviceId}`,
    keys: { p256dh: "p256dh", auth: "auth" },
  };
}

describe("PushSubscriptionService", () => {
  it("subscribe() twice with the same deviceId upserts the same row instead of duplicating", async () => {
    const service = new PushSubscriptionService(new InMemoryPushSubscriptionRepository());
    const first = await service.subscribe("user-1", input("device-a"));
    const second = await service.subscribe("user-1", input("device-a"));
    expect(second.id).toBe(first.id);

    const devices = await service.listMyDevices("user-1");
    expect(devices).toHaveLength(1);
  });

  it("a user can have multiple devices — each deviceId is its own row", async () => {
    const service = new PushSubscriptionService(new InMemoryPushSubscriptionRepository());
    await service.subscribe("user-1", input("device-a"));
    await service.subscribe("user-1", input("device-b"));

    const devices = await service.listMyDevices("user-1");
    expect(devices).toHaveLength(2);
  });

  it("unsubscribe flips status to REVOKED (soft) rather than deleting the row", async () => {
    const service = new PushSubscriptionService(new InMemoryPushSubscriptionRepository());
    const subscription = await service.subscribe("user-1", input("device-a"));
    await service.unsubscribe("user-1", subscription.id);

    const devices = await service.listMyDevices("user-1");
    expect(devices).toHaveLength(1);
    expect(devices[0].status).toBe("REVOKED");
  });

  it("unsubscribe rejects a caller who doesn't own the subscription", async () => {
    const service = new PushSubscriptionService(new InMemoryPushSubscriptionRepository());
    const subscription = await service.subscribe("user-1", input("device-a"));
    await expect(service.unsubscribe("someone-else", subscription.id)).rejects.toThrow();
  });

  it("unsubscribe on an unknown id throws NotFound", async () => {
    const service = new PushSubscriptionService(new InMemoryPushSubscriptionRepository());
    await expect(service.unsubscribe("user-1", "does-not-exist")).rejects.toThrow();
  });
});
