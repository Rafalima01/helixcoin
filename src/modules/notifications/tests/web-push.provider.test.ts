import { describe, expect, it, vi, beforeEach } from "vitest";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

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

const PAYLOAD = { title: "t", body: "b", icon: "i", deepLink: "d", priority: "normal" as const, category: "DEPOSIT_CONFIRMED", logId: "log-1" };

describe("WebPushProvider", () => {
  beforeEach(() => {
    sendNotification.mockReset();
    setVapidDetails.mockReset();
  });

  it("send() succeeds and calls webpush.sendNotification with the subscription's endpoint/keys", async () => {
    sendNotification.mockResolvedValue(undefined);
    const provider = new WebPushProvider();
    const result = await provider.send(SUBSCRIPTION, PAYLOAD);

    expect(result.success).toBe(true);
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: SUBSCRIPTION.endpoint, keys: { p256dh: SUBSCRIPTION.p256dh, auth: SUBSCRIPTION.auth } },
      JSON.stringify(PAYLOAD)
    );
  });

  it("send() maps a 410 error to expired:true", async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error("Gone"), { statusCode: 410 }));
    const provider = new WebPushProvider();
    const result = await provider.send(SUBSCRIPTION, PAYLOAD);

    expect(result.success).toBe(false);
    expect(result.expired).toBe(true);
  });

  it("send() maps a generic error to expired:false", async () => {
    sendNotification.mockRejectedValue(new Error("network blip"));
    const provider = new WebPushProvider();
    const result = await provider.send(SUBSCRIPTION, PAYLOAD);

    expect(result.success).toBe(false);
    expect(result.expired).toBeFalsy();
    expect(result.errorMessage).toBe("network blip");
  });

  it("healthCheck() reports ONLINE", async () => {
    const provider = new WebPushProvider();
    const health = await provider.healthCheck();
    expect(health.status).toBe("ONLINE");
  });
});
