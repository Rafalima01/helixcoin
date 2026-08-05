import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/notifications", () => ({
  NotificationService: { notify: vi.fn() },
  NOTIFICATION_TYPES: { system: "system" },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    managerProfile: { findUnique: vi.fn().mockResolvedValue(null) },
    user: { groupBy: vi.fn().mockResolvedValue([]) },
    deposit: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { prisma } from "@/lib/prisma";
import { ManagerService } from "@/modules/manager/services/manager.service";
import { InMemoryManagerRepository } from "@/modules/manager/repositories/manager.in-memory-repository";
import { AffiliateService } from "@/modules/affiliate/services/affiliate.service";
import { InMemoryAffiliateRepository } from "@/modules/affiliate/repositories/affiliate.in-memory-repository";
import { InMemoryAffiliateSettingsRepository } from "@/modules/affiliate/repositories/affiliate-settings.in-memory-repository";
import { InMemoryCommissionRepository } from "@/modules/affiliate/repositories/commission.in-memory-repository";

const ACTOR = { id: "admin-1", role: "ADMIN" as const };
const META = { ip: null, userAgent: null };

/** Fully in-memory harness — no real Prisma anywhere, mirrors buildAffiliateTestHarness/buildPaymentTestHarness. */
function buildService() {
  const managers = new InMemoryManagerRepository();
  const affiliates = new InMemoryAffiliateRepository();
  const settingsRepo = new InMemoryAffiliateSettingsRepository();
  const commissions = new InMemoryCommissionRepository();
  const affiliateService = new AffiliateService(affiliates, settingsRepo);
  const service = new ManagerService(managers, affiliateService, commissions);
  return { service, managers, affiliateService, settingsRepo, commissions };
}

/** ManagerService no longer creates managers — that's ManagerInviteService's job (see manager-invite.service.test.ts). Tests here seed a ManagerProfile directly, same as ManagerInviteService.accept() would end up doing. */
let seq = 0;
async function seedManager(managers: InMemoryManagerRepository, userId: string) {
  seq += 1;
  return managers.create({
    userId,
    inviteCode: `CODE${seq}`,
    commissionPercent: 0,
    status: "ACTIVE",
    inviteId: null,
  });
}

describe("ManagerService", () => {
  it("getNetworkAffiliate() throws Forbidden when the affiliate belongs to a different manager", async () => {
    const { service, managers, affiliateService } = buildService();
    const managerA = await seedManager(managers, "manager-user-A");
    const managerB = await seedManager(managers, "manager-user-B");

    const affiliate = await affiliateService.apply("affiliate-user-1", {});
    await affiliateService.assignManager(affiliate.id, managerB.id);

    await expect(service.getNetworkAffiliate(managerA.id, affiliate.id)).rejects.toThrow();
    const found = await service.getNetworkAffiliate(managerB.id, affiliate.id);
    expect(found.id).toBe(affiliate.id);
  });

  it("decideApplication() delegates to AffiliateService.decide with the manager's own id as scope", async () => {
    const { service, managers, affiliateService, settingsRepo } = buildService();
    const manager = await seedManager(managers, "manager-user-C");
    const affiliate = await affiliateService.apply("affiliate-user-2", {});
    await affiliateService.assignManager(affiliate.id, manager.id);
    await settingsRepo.update({ requireManagerApprovalForAffiliates: true });

    const decided = await service.decideApplication(manager.id, affiliate.id, "APPROVE", undefined, "manager-user-C");
    expect(decided.status).toBe("APPROVED");
  });

  it("decideApplication() rejects a manager acting outside their own network", async () => {
    const { service, managers, affiliateService, settingsRepo } = buildService();
    const managerA = await seedManager(managers, "manager-user-D");
    const managerB = await seedManager(managers, "manager-user-E");
    const affiliate = await affiliateService.apply("affiliate-user-3", {});
    await affiliateService.assignManager(affiliate.id, managerB.id);
    await settingsRepo.update({ requireManagerApprovalForAffiliates: true });

    await expect(
      service.decideApplication(managerA.id, affiliate.id, "APPROVE", undefined, "manager-user-D")
    ).rejects.toThrow();
  });

  it("getDashboard() aggregates commission totals scoped to the manager's own network only, split into paid-to-affiliates vs kept-by-manager", async () => {
    const { service, managers, affiliateService, commissions } = buildService();
    const managerA = await seedManager(managers, "manager-user-F");
    const managerB = await seedManager(managers, "manager-user-G");
    const affA = await affiliateService.apply("affiliate-user-4", {});
    await affiliateService.assignManager(affA.id, managerA.id);
    await affiliateService.decide(affA.id, "APPROVE", undefined, ACTOR as never);
    const affB = await affiliateService.apply("affiliate-user-5", {});
    await affiliateService.assignManager(affB.id, managerB.id);
    await affiliateService.decide(affB.id, "APPROVE", undefined, ACTOR as never);

    await commissions.create({
      affiliateId: affA.id,
      payeeUserId: "affiliate-user-4",
      managerId: managerA.id,
      level: 1,
      originUserId: "player-1",
      sourceType: "REVSHARE_DEPOSIT",
      triggerId: "dep-1",
      amountCents: 1000,
      status: "AVAILABLE",
    });
    // Manager A's own spread from that same affiliate's traffic — must show up as
    // "kept by manager", never blended back into a single "commission total" that
    // (combined with deposit totals elsewhere) would let the manager infer house margin.
    await commissions.create({
      affiliateId: affA.id,
      payeeUserId: "manager-user-F",
      managerId: managerA.id,
      level: 1,
      originUserId: "player-1",
      sourceType: "MANAGER_SPREAD",
      triggerId: "dep-1",
      amountCents: 400,
      status: "AVAILABLE",
    });
    await commissions.create({
      affiliateId: affB.id,
      payeeUserId: "affiliate-user-5",
      managerId: managerB.id,
      level: 1,
      originUserId: "player-2",
      sourceType: "REVSHARE_DEPOSIT",
      triggerId: "dep-2",
      amountCents: 5000,
      status: "AVAILABLE",
    });

    const dashboard = await service.getDashboard(managerA.id);
    expect(dashboard.paidToAffiliatesTotalCents).toBe(1000);
    expect(dashboard.keptByManagerTotalCents).toBe(400);
    expect(dashboard.affiliatesActive).toBe(1);
    expect(dashboard).not.toHaveProperty("commissionTotalCents");
  });

  it("activateProfile() flips a PENDING manager to ACTIVE", async () => {
    const { service, managers } = buildService();
    const manager = await managers.create({ userId: "manager-user-H", inviteCode: "CODEH", commissionPercent: 0, status: "PENDING", inviteId: null });
    const activated = await service.activateProfile(manager.id, ACTOR, META);
    expect(activated.status).toBe("ACTIVE");
  });

  it("activateProfile() rejects an already-active manager", async () => {
    const { service, managers } = buildService();
    const manager = await seedManager(managers, "manager-user-I");
    await expect(service.activateProfile(manager.id, ACTOR, META)).rejects.toThrow();
  });

  it("updateCommission() persists a new commissionPercent", async () => {
    const { service, managers } = buildService();
    const manager = await seedManager(managers, "manager-user-J");
    const updated = await service.updateCommission(manager.id, 12.5, ACTOR, META);
    expect(updated.commissionPercent).toBe(12.5);
  });

  it("getNetworkWithStats() splits deposits/players-referred/commissions per affiliate, with one affiliate having a referred player but zero deposits and another an FTD", async () => {
    const { service, managers, affiliateService, commissions } = buildService();
    const manager = await seedManager(managers, "manager-user-K");

    const affiliate1 = await affiliateService.apply("affiliate-user-K1", {});
    await affiliateService.assignManager(affiliate1.id, manager.id);
    await affiliateService.decide(affiliate1.id, "APPROVE", undefined, ACTOR as never);

    // Referred a player but that player hasn't deposited yet — this is exactly the
    // reported bug scenario: a fresh signup through the affiliate's /r/{code} link
    // must show up in playersReferredCount immediately, with everything else at
    // zero, not disappear as if the referral never happened.
    const affiliate2 = await affiliateService.apply("affiliate-user-K2", {});
    await affiliateService.assignManager(affiliate2.id, manager.id);
    await affiliateService.decide(affiliate2.id, "APPROVE", undefined, ACTOR as never);

    await commissions.create({
      affiliateId: affiliate1.id,
      payeeUserId: "affiliate-user-K1",
      managerId: manager.id,
      level: 1,
      originUserId: "player-k-a",
      sourceType: "REVSHARE_DEPOSIT",
      triggerId: "dep-k-1",
      amountCents: 500,
      status: "AVAILABLE",
    });
    await commissions.create({
      affiliateId: affiliate1.id,
      payeeUserId: "affiliate-user-K1",
      managerId: manager.id,
      level: 1,
      originUserId: "player-k-a",
      sourceType: "CPA_FTD",
      triggerId: "dep-k-1:cpa",
      amountCents: 200,
      status: "AVAILABLE",
    });
    await commissions.create({
      affiliateId: affiliate1.id,
      payeeUserId: "manager-user-K",
      managerId: manager.id,
      level: 1,
      originUserId: "player-k-a",
      sourceType: "MANAGER_SPREAD",
      triggerId: "dep-k-1",
      amountCents: 300,
      status: "AVAILABLE",
    });

    // affiliate1: two direct referrals — one PENDING (the status every real signup
    // gets and never leaves), one ACTIVE — both must count toward playersReferredCount.
    // affiliate2: one direct referral, PENDING, who never deposited.
    vi.mocked(prisma.user.groupBy).mockResolvedValueOnce([
      { referredById: "affiliate-user-K1", _count: { _all: 2 } },
      { referredById: "affiliate-user-K2", _count: { _all: 1 } },
    ] as never);
    vi.mocked(prisma.deposit.findMany).mockResolvedValueOnce([
      { amountCents: 3000, user: { referredById: "affiliate-user-K1" } },
      { amountCents: 2000, user: { referredById: "affiliate-user-K1" } },
    ] as never);

    const { items, total } = await service.getNetworkWithStats(manager.id);
    expect(total).toBe(2);

    const row1 = items.find((r) => r.id === affiliate1.id)!;
    expect(row1.playersReferredCount).toBe(2);
    expect(row1.depositTotalCents).toBe(5000);
    expect(row1.ftdCount).toBe(1);
    expect(row1.paidToAffiliateCents).toBe(700); // 500 REVSHARE_DEPOSIT + 200 CPA_FTD
    expect(row1.keptByManagerCents).toBe(300);
    expect(row1).not.toHaveProperty("commissionGeneratedCents");
    expect(row1).not.toHaveProperty("houseProfitCents");

    const row2 = items.find((r) => r.id === affiliate2.id)!;
    expect(row2.playersReferredCount).toBe(1); // referred, PENDING, zero deposits — still visible
    expect(row2.depositTotalCents).toBe(0);
    expect(row2.ftdCount).toBe(0);
    expect(row2.paidToAffiliateCents).toBe(0);
    expect(row2.keptByManagerCents).toBe(0);
  });
});
