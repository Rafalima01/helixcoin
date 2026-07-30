import { describe, expect, it } from "vitest";
import { NotImplementedPushProvider } from "@/modules/notifications/providers/not-implemented.provider";
import { PushProviderFactory } from "@/modules/notifications/factories/push-provider.factory";
import { WebPushProvider } from "@/modules/notifications/providers/web-push/web-push.provider";
import type { PushSubscription } from "@/modules/notifications/entities/notifications.entity";

const SUBSCRIPTION: PushSubscription = {
  id: "sub-1",
  userId: "u1",
  deviceId: "d1",
  browser: null,
  os: null,
  endpoint: "https://push.example.com/abc",
  p256dh: "p256dh-key",
  auth: "auth-key",
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("NotImplementedPushProvider", () => {
  it("every real-operation method throws", async () => {
    const provider = new NotImplementedPushProvider("FCM");
    const payload = { title: "t", body: "b", category: "DEPOSIT_CONFIRMED", logId: "l1" };

    await expect(provider.send(SUBSCRIPTION, payload)).rejects.toThrow();
    await expect(provider.sendMany([SUBSCRIPTION], payload)).rejects.toThrow();
    await expect(provider.subscribe({ endpoint: "e", p256dh: "p", auth: "a" })).rejects.toThrow();
    await expect(provider.unsubscribe("sub-1")).rejects.toThrow();
    await expect(provider.validateToken(SUBSCRIPTION)).rejects.toThrow();
  });

  it("healthCheck() reports OFFLINE instead of throwing", async () => {
    const provider = new NotImplementedPushProvider("APNS");
    const health = await provider.healthCheck();
    expect(health.status).toBe("OFFLINE");
  });
});

describe("PushProviderFactory", () => {
  it("resolves WEB_PUSH to a functional WebPushProvider", () => {
    expect(PushProviderFactory.forPlatform("WEB_PUSH")).toBeInstanceOf(WebPushProvider);
  });

  it.each(["FCM", "APNS", "ONESIGNAL"] as const)("resolves %s to NotImplementedPushProvider", (platform) => {
    const provider = PushProviderFactory.forPlatform(platform);
    expect(provider).toBeInstanceOf(NotImplementedPushProvider);
    expect(provider.name).toBe(platform);
  });
});
