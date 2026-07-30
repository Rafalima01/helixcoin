import { describe, expect, it } from "vitest";
import { InMemoryNotificationPreferenceRepository } from "@/modules/notifications/repositories/notification-preference.in-memory-repository";
import { NotificationPreferenceService } from "@/modules/notifications/services/notification-preference.service";
import { ADMIN_NOTIFICATION_CATEGORIES, MANAGER_NOTIFICATION_CATEGORIES } from "@/modules/notifications/constants/notifications.constants";

describe("NotificationPreferenceService", () => {
  it("listForRole returns every admin category defaulting to enabled=true when no override exists", async () => {
    const service = new NotificationPreferenceService(new InMemoryNotificationPreferenceRepository());
    const result = await service.listForRole("admin-1", "SUPER_ADMIN");
    expect(result).toHaveLength(ADMIN_NOTIFICATION_CATEGORIES.length);
    expect(result.every((r) => r.enabled)).toBe(true);
  });

  it("listForRole returns only the 2 manager-network categories for MANAGER, never the admin ones", async () => {
    const service = new NotificationPreferenceService(new InMemoryNotificationPreferenceRepository());
    const result = await service.listForRole("manager-1", "MANAGER");
    expect(result.map((r) => r.category).sort()).toEqual([...MANAGER_NOTIFICATION_CATEGORIES].sort());
  });

  it("listForRole returns an empty list for AFFILIATE (Fase X: no push categories for that role yet)", async () => {
    const service = new NotificationPreferenceService(new InMemoryNotificationPreferenceRepository());
    const result = await service.listForRole("affiliate-1", "AFFILIATE");
    expect(result).toEqual([]);
  });

  it("update persists a disabled override that listForRole then reflects", async () => {
    const service = new NotificationPreferenceService(new InMemoryNotificationPreferenceRepository());
    await service.update("admin-1", "ADMIN", "DEPOSIT_CONFIRMED", false);
    const result = await service.listForRole("admin-1", "ADMIN");
    expect(result.find((r) => r.category === "DEPOSIT_CONFIRMED")?.enabled).toBe(false);
  });

  it("update rejects a category outside the caller's role scope", async () => {
    const service = new NotificationPreferenceService(new InMemoryNotificationPreferenceRepository());
    await expect(service.update("manager-1", "MANAGER", "DEPOSIT_CONFIRMED", false)).rejects.toThrow();
  });
});
