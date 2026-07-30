import { describe, expect, it } from "vitest";
import { InMemoryPushNotificationLogRepository } from "@/modules/notifications/repositories/push-notification-log.in-memory-repository";
import { NotificationHistoryService } from "@/modules/notifications/services/notification-history.service";

describe("NotificationHistoryService", () => {
  it("markDelivered only transitions SENT -> DELIVERED, never a QUEUED or already-CLICKED row", async () => {
    const logs = new InMemoryPushNotificationLogRepository();
    const service = new NotificationHistoryService(logs);

    const queued = await logs.create({ subscriptionId: "sub-1", userId: "u1", category: "DEPOSIT_CONFIRMED", title: "t", body: "b" });
    await service.markDelivered(queued.id);
    expect((await logs.findById(queued.id))?.status).toBe("QUEUED"); // untouched — was never SENT

    await logs.update(queued.id, { status: "SENT", sentAt: new Date() });
    await service.markDelivered(queued.id);
    const delivered = await logs.findById(queued.id);
    expect(delivered?.status).toBe("DELIVERED");
    expect(delivered?.deliveredAt).toBeTruthy();

    await logs.update(queued.id, { status: "CLICKED" });
    await service.markDelivered(queued.id); // no-op, not SENT anymore
    expect((await logs.findById(queued.id))?.status).toBe("CLICKED");
  });

  it("markClicked sets CLICKED and backfills deliveredAt when the delivered beacon never landed", async () => {
    const logs = new InMemoryPushNotificationLogRepository();
    const service = new NotificationHistoryService(logs);

    const log = await logs.create({ subscriptionId: "sub-1", userId: "u1", category: "DEPOSIT_CONFIRMED", title: "t", body: "b" });
    await logs.update(log.id, { status: "SENT", sentAt: new Date() });

    await service.markClicked(log.id);
    const clicked = await logs.findById(log.id);
    expect(clicked?.status).toBe("CLICKED");
    expect(clicked?.clickedAt).toBeTruthy();
    expect(clicked?.deliveredAt).toBeTruthy(); // backfilled
  });

  it("markDelivered/markClicked on an unknown logId silently no-op (beacons never throw on the client)", async () => {
    const service = new NotificationHistoryService(new InMemoryPushNotificationLogRepository());
    await expect(service.markDelivered("does-not-exist")).resolves.toBeUndefined();
    await expect(service.markClicked("does-not-exist")).resolves.toBeUndefined();
  });

  it("listAdmin filters by status", async () => {
    const logs = new InMemoryPushNotificationLogRepository();
    const service = new NotificationHistoryService(logs);
    const a = await logs.create({ subscriptionId: "sub-1", userId: "u1", category: "DEPOSIT_CONFIRMED", title: "t", body: "b" });
    await logs.create({ subscriptionId: "sub-2", userId: "u2", category: "DEPOSIT_CONFIRMED", title: "t", body: "b" });
    await logs.update(a.id, { status: "SENT" });

    const { items, total } = await service.listAdmin({ status: "SENT", page: 1, pageSize: 10 });
    expect(total).toBe(1);
    expect(items[0].id).toBe(a.id);
  });
});
