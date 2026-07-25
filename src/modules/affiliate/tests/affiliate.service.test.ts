import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/notifications", () => ({
  NotificationService: { notify: vi.fn() },
  NOTIFICATION_TYPES: {
    system: "system",
    accountApproved: "account_approved",
    accountBlocked: "account_blocked",
    documentsPending: "documents_pending",
    newCommission: "new_commission",
  },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { managerProfile: { findUnique: vi.fn().mockResolvedValue(null) } },
}));

import { buildAffiliateTestHarness } from "@/modules/affiliate/tests/test-helpers";
import type { DecisionActor } from "@/modules/affiliate/services/affiliate.service";

const USER_ID = "user-aff-1";
const ADMIN_ACTOR: DecisionActor = { actorId: "admin-1", actorRole: "ADMIN" };
const MANAGER_ACTOR: DecisionActor = { actorId: "manager-user-1", actorRole: "MANAGER" };

describe("AffiliateService", () => {
  it("apply() creates a PENDING profile and rejects a second application", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    const profile = await affiliateService.apply(USER_ID, {});
    expect(profile.status).toBe("PENDING");

    await expect(affiliateService.apply(USER_ID, {})).rejects.toThrow();
  });

  it("decide(APPROVE) by an Admin moves PENDING -> APPROVED", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    const profile = await affiliateService.apply(USER_ID, {});
    const approved = await affiliateService.decide(profile.id, "APPROVE", undefined, ADMIN_ACTOR);
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedById).toBe("admin-1");
  });

  it("decide(REJECT) requires a reason and records it", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    const profile = await affiliateService.apply(USER_ID, {});
    const rejected = await affiliateService.decide(profile.id, "REJECT", "Documentos inválidos", ADMIN_ACTOR);
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Documentos inválidos");
  });

  it("decide(BLOCK) works even on an already-APPROVED affiliate", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    const profile = await affiliateService.apply(USER_ID, {});
    await affiliateService.decide(profile.id, "APPROVE", undefined, ADMIN_ACTOR);
    const blocked = await affiliateService.decide(profile.id, "BLOCK", "Fraude suspeita", ADMIN_ACTOR);
    expect(blocked.status).toBe("BLOCKED");
  });

  it("re-approving an already-APPROVED affiliate is rejected as a business rule violation", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    const profile = await affiliateService.apply(USER_ID, {});
    await affiliateService.decide(profile.id, "APPROVE", undefined, ADMIN_ACTOR);
    await expect(affiliateService.decide(profile.id, "APPROVE", undefined, ADMIN_ACTOR)).rejects.toThrow();
  });

  it("a Manager cannot decide an affiliate outside their own network", async () => {
    const { affiliateService, affiliates } = buildAffiliateTestHarness();
    const profile = await affiliateService.apply(USER_ID, {});
    // Assign to a DIFFERENT manager than the one deciding.
    await affiliates.update(profile.id, { managerId: "manager-profile-A" });
    await expect(
      affiliateService.decide(profile.id, "APPROVE", undefined, MANAGER_ACTOR, "manager-profile-B")
    ).rejects.toThrow();
  });

  it("a Manager cannot decide at all when requireManagerApprovalForAffiliates is off (default)", async () => {
    const { affiliateService, affiliates } = buildAffiliateTestHarness();
    const profile = await affiliateService.apply(USER_ID, {});
    await affiliates.update(profile.id, { managerId: "manager-profile-A" });
    await expect(
      affiliateService.decide(profile.id, "APPROVE", undefined, MANAGER_ACTOR, "manager-profile-A")
    ).rejects.toThrow();
  });

  it("a Manager CAN decide their own affiliate once requireManagerApprovalForAffiliates is enabled", async () => {
    const { affiliateService, affiliates, settingsRepo } = buildAffiliateTestHarness();
    await settingsRepo.update({ requireManagerApprovalForAffiliates: true });
    const profile = await affiliateService.apply(USER_ID, {});
    await affiliates.update(profile.id, { managerId: "manager-profile-A" });
    const approved = await affiliateService.decide(profile.id, "APPROVE", undefined, MANAGER_ACTOR, "manager-profile-A");
    expect(approved.status).toBe("APPROVED");
  });

  describe("updateCommission() — manager ceiling rule (Refinamento Fase 8)", () => {
    it("accepts a percent at or below the affiliate's manager's ceiling", async () => {
      const { affiliateService, managers } = buildAffiliateTestHarness();
      const manager = await managers.create({ userId: "manager-user-2", inviteCode: "MGR010", commissionPercent: 70, status: "ACTIVE" });
      const profile = await affiliateService.apply(USER_ID, {});
      await affiliateService.assignManager(profile.id, manager.id);

      const updated = await affiliateService.updateCommission(profile.id, 50, ADMIN_ACTOR);
      expect(updated.revShareOverridePercent).toBeCloseTo(0.5);
    });

    it("rejects a percent above the affiliate's manager's ceiling", async () => {
      const { affiliateService, managers } = buildAffiliateTestHarness();
      const manager = await managers.create({ userId: "manager-user-3", inviteCode: "MGR011", commissionPercent: 70, status: "ACTIVE" });
      const profile = await affiliateService.apply(USER_ID, {});
      await affiliateService.assignManager(profile.id, manager.id);

      await expect(affiliateService.updateCommission(profile.id, 71, ADMIN_ACTOR)).rejects.toThrow();
    });

    it("scopeManagerId enforces that a Manager can only set commission for their own network's affiliates", async () => {
      const { affiliateService, managers } = buildAffiliateTestHarness();
      const managerA = await managers.create({ userId: "manager-user-4", inviteCode: "MGR012", commissionPercent: 70, status: "ACTIVE" });
      const profile = await affiliateService.apply(USER_ID, {});
      await affiliateService.assignManager(profile.id, managerA.id);

      await expect(
        affiliateService.updateCommission(profile.id, 30, MANAGER_ACTOR, "some-other-manager-id")
      ).rejects.toThrow();

      const updated = await affiliateService.updateCommission(profile.id, 30, MANAGER_ACTOR, managerA.id);
      expect(updated.revShareOverridePercent).toBeCloseTo(0.3);
    });

    it("an affiliate with no manager has no ceiling to enforce", async () => {
      const { affiliateService } = buildAffiliateTestHarness();
      const profile = await affiliateService.apply(USER_ID, {});
      const updated = await affiliateService.updateCommission(profile.id, 80, ADMIN_ACTOR);
      expect(updated.revShareOverridePercent).toBeCloseTo(0.8);
    });
  });
});
