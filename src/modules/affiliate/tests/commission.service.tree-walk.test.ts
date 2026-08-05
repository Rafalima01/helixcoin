import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/notifications", () => ({
  NotificationService: { notify: vi.fn() },
  NOTIFICATION_TYPES: { newCommission: "new_commission" },
}));

import { buildAffiliateTestHarness } from "@/modules/affiliate/tests/test-helpers";
import type { DepositEventPayload } from "@/modules/payments/events/payments.events";

const SYSTEM_ACTOR = { actorId: null, actorType: "SYSTEM" as const };

/** Chain: PLAYER -> L1 (affiliate) -> L2 (affiliate) -> L3 (NOT an affiliate) -> L4 (affiliate, out of range). */
async function seedThreeLevelChain(h: ReturnType<typeof import("@/modules/affiliate/tests/test-helpers").buildAffiliateTestHarness>) {
  h.userReferrals.setReferrer("player", "l1-user");
  h.userReferrals.setReferrer("l1-user", "l2-user");
  h.userReferrals.setReferrer("l2-user", "l3-user");
  h.userReferrals.setReferrer("l3-user", "l4-user");

  const l1 = await h.affiliateService.apply("l1-user", {});
  await h.affiliateService.decide(l1.id, "APPROVE", undefined, { actorId: "admin", actorRole: "ADMIN" });

  const l2 = await h.affiliateService.apply("l2-user", {});
  await h.affiliateService.decide(l2.id, "APPROVE", undefined, { actorId: "admin", actorRole: "ADMIN" });

  // l3-user is deliberately NOT an affiliate at all — the chain must not break because of it.
  const l4 = await h.affiliateService.apply("l4-user", {});
  await h.affiliateService.decide(l4.id, "APPROVE", undefined, { actorId: "admin", actorRole: "ADMIN" });

  return { l1, l2, l4 };
}

describe("CommissionService — multi-level tree walk", () => {
  it("credits level 1 and level 2 affiliates, skips the non-affiliate level 3, ignores level 4 (out of range)", async () => {
    const h = buildAffiliateTestHarness();
    const { l1, l2 } = await seedThreeLevelChain(h);
    await h.settingsRepo.update({ revShareLevel1Percent: 0.1, revShareLevel2Percent: 0.05, revShareLevel3Percent: 0.02 });

    const payload: DepositEventPayload = {
      depositId: "dep-1",
      userId: "player",
      amountCents: 10000,
      gatewayCredentialId: "gw-1",
      status: "PAID",
    };
    await h.commissionService.handleDepositConfirmed(payload);

    const l1Balance = await h.walletService.getBalance("l1-user");
    const l2Balance = await h.walletService.getBalance("l2-user");
    const l4Balance = await h.walletService.getBalance("l4-user");

    expect(l1Balance.main).toBe(1000); // 10% of 10000, auto-approved (LOCKED -> MAIN by default)
    expect(l2Balance.main).toBe(500); // 5% of 10000
    expect(l4Balance.main).toBe(0); // 4 hops away — out of MAX_COMMISSION_LEVEL range

    const { total: l1CommissionCount } = await h.commissions.listAdmin({ affiliateId: l1.id, page: 1, pageSize: 10 });
    expect(l1CommissionCount).toBe(1);
  });

  it("commissions stay LOCKED when autoApproveCommissions is off", async () => {
    const h = buildAffiliateTestHarness();
    await seedThreeLevelChain(h);
    await h.settingsRepo.update({ autoApproveCommissions: false, revShareLevel1Percent: 0.1 });

    await h.commissionService.handleDepositConfirmed({
      depositId: "dep-2",
      userId: "player",
      amountCents: 5000,
      gatewayCredentialId: "gw-1",
      status: "PAID",
    });

    const balance = await h.walletService.getBalance("l1-user");
    expect(balance.main).toBe(0);
    expect(balance.locked).toBe(500);
  });

  it("applies the flat CPA bonus only at level 1, only on the player's first-ever confirmed deposit", async () => {
    const h = buildAffiliateTestHarness();
    await seedThreeLevelChain(h);
    await h.settingsRepo.update({ cpaAmountCents: 2000, revShareLevel1Percent: 0.1 });

    // Real PaymentService.settle() order: credit the player's DEPOSIT wallet
    // transaction FIRST, THEN publish depositConfirmed (which this test
    // simulates by calling handleDepositConfirmed directly afterwards).
    await h.walletService.credit({
      userId: "player",
      amountCents: 10000,
      type: "DEPOSIT",
      origin: "payments",
      originId: "dep-ftd",
      idempotencyKey: "deposit:dep-ftd:confirm",
      actor: SYSTEM_ACTOR,
    });
    await h.commissionService.handleDepositConfirmed({
      depositId: "dep-ftd",
      userId: "player",
      amountCents: 10000,
      gatewayCredentialId: "gw-1",
      status: "PAID",
    });

    const afterFirst = await h.walletService.getBalance("l1-user");
    // 10% revshare (1000) + 2000 CPA = 3000
    expect(afterFirst.main).toBe(3000);

    // A second deposit from the same player must NOT trigger CPA again.
    await h.walletService.credit({
      userId: "player",
      amountCents: 10000,
      type: "DEPOSIT",
      origin: "payments",
      originId: "dep-second",
      idempotencyKey: "deposit:dep-second:confirm",
      actor: SYSTEM_ACTOR,
    });
    await h.commissionService.handleDepositConfirmed({
      depositId: "dep-second",
      userId: "player",
      amountCents: 10000,
      gatewayCredentialId: "gw-1",
      status: "PAID",
    });

    const afterSecond = await h.walletService.getBalance("l1-user");
    // + another 1000 revshare, no additional CPA
    expect(afterSecond.main).toBe(4000);
  });

  it("replaying the same depositConfirmed event never double-credits (idempotent)", async () => {
    const h = buildAffiliateTestHarness();
    await seedThreeLevelChain(h);
    await h.settingsRepo.update({ revShareLevel1Percent: 0.1 });

    const payload: DepositEventPayload = {
      depositId: "dep-replay",
      userId: "player",
      amountCents: 10000,
      gatewayCredentialId: "gw-1",
      status: "PAID",
    };
    await h.commissionService.handleDepositConfirmed(payload);
    await h.commissionService.handleDepositConfirmed(payload);

    const balance = await h.walletService.getBalance("l1-user");
    expect(balance.main).toBe(1000);
  });

  it("a rejected/blocked ancestor earns nothing, even mid-chain", async () => {
    const h = buildAffiliateTestHarness();
    const { l1 } = await seedThreeLevelChain(h);
    await h.affiliateService.decide(l1.id, "BLOCK", "teste", { actorId: "admin", actorRole: "ADMIN" });
    await h.settingsRepo.update({ revShareLevel1Percent: 0.1, revShareLevel2Percent: 0.05 });

    await h.commissionService.handleDepositConfirmed({
      depositId: "dep-blocked",
      userId: "player",
      amountCents: 10000,
      gatewayCredentialId: "gw-1",
      status: "PAID",
    });

    const l1Balance = await h.walletService.getBalance("l1-user");
    const l2Balance = await h.walletService.getBalance("l2-user");
    expect(l1Balance.main).toBe(0);
    expect(l2Balance.main).toBe(500); // level 2 still earns despite level 1 being blocked
  });

  describe("manager spread model (Refinamento Fase 8)", () => {
    it("a level-1 ancestor who is a Manager (no AffiliateProfile) earns their full ceiling on their own platform link", async () => {
      const h = buildAffiliateTestHarness();
      h.userReferrals.setReferrer("player", "manager-user");
      await h.managers.create({ userId: "manager-user", inviteCode: "MGR001", commissionPercent: 70, status: "ACTIVE" });

      await h.commissionService.handleDepositConfirmed({
        depositId: "dep-mgr-direct",
        userId: "player",
        amountCents: 10000,
        gatewayCredentialId: "gw-1",
        status: "PAID",
      });

      const managerBalance = await h.walletService.getBalance("manager-user");
      expect(managerBalance.main).toBe(7000); // 70% ceiling, full — no affiliate in the path

      const { items } = await h.commissions.listAdmin({ managerId: (await h.managers.findByUserId("manager-user"))!.id, page: 1, pageSize: 10 });
      expect(items).toHaveLength(1);
      expect(items[0].sourceType).toBe("MANAGER_SPREAD");
      expect(items[0].affiliateId).toBeNull();
    });

    it("Manager 70% / Affiliate 50% → affiliate earns 50%, manager earns the 20% spread", async () => {
      const h = buildAffiliateTestHarness();
      h.userReferrals.setReferrer("player", "affiliate-user");
      const manager = await h.managers.create({ userId: "manager-user", inviteCode: "MGR002", commissionPercent: 70, status: "ACTIVE" });

      const affiliate = await h.affiliateService.apply("affiliate-user", {});
      await h.affiliateService.assignManager(affiliate.id, manager.id);
      await h.affiliateService.decide(affiliate.id, "APPROVE", undefined, { actorId: "admin", actorRole: "ADMIN" });
      await h.affiliates.update(affiliate.id, { revShareOverridePercent: 0.5 });

      await h.commissionService.handleDepositConfirmed({
        depositId: "dep-spread-1",
        userId: "player",
        amountCents: 10000,
        gatewayCredentialId: "gw-1",
        status: "PAID",
      });

      const affiliateBalance = await h.walletService.getBalance("affiliate-user");
      const managerBalance = await h.walletService.getBalance("manager-user");
      expect(affiliateBalance.main).toBe(5000); // 50%
      expect(managerBalance.main).toBe(2000); // 70% - 50% = 20% spread

      // The MANAGER_SPREAD row now carries the triggering affiliate's id (previously always null) —
      // this is what lets "Minha Rede" compute "quanto ficou para o gerente" per affiliate.
      // Regression guard for the dedup-key collision this introduces: findByTriggerAffiliateLevel
      // must also key on sourceType, or this MANAGER_SPREAD generate() call would false-positive
      // match the affiliate's own REVSHARE_DEPOSIT row (same triggerId/affiliateId/level) and
      // silently skip — which is exactly why managerBalance.main asserted above would be 0, not 2000,
      // if that guard were missing.
      const paidToAffiliate = await h.commissions.sumAmountCents({ affiliateId: affiliate.id, sourceType: "REVSHARE_DEPOSIT" });
      const keptByManager = await h.commissions.sumAmountCents({ affiliateId: affiliate.id, sourceType: "MANAGER_SPREAD" });
      expect(paidToAffiliate).toBe(5000);
      expect(keptByManager).toBe(2000);

      const { items } = await h.commissions.listAdmin({ affiliateId: affiliate.id, page: 1, pageSize: 10 });
      const spreadRow = items.find((r) => r.sourceType === "MANAGER_SPREAD");
      expect(spreadRow?.affiliateId).toBe(affiliate.id);
    });

    it("Manager 70% / Affiliate 70% (at the ceiling) → manager earns nothing extra", async () => {
      const h = buildAffiliateTestHarness();
      h.userReferrals.setReferrer("player", "affiliate-user");
      const manager = await h.managers.create({ userId: "manager-user", inviteCode: "MGR003", commissionPercent: 70, status: "ACTIVE" });

      const affiliate = await h.affiliateService.apply("affiliate-user", {});
      await h.affiliateService.assignManager(affiliate.id, manager.id);
      await h.affiliateService.decide(affiliate.id, "APPROVE", undefined, { actorId: "admin", actorRole: "ADMIN" });
      await h.affiliates.update(affiliate.id, { revShareOverridePercent: 0.7 });

      await h.commissionService.handleDepositConfirmed({
        depositId: "dep-spread-2",
        userId: "player",
        amountCents: 10000,
        gatewayCredentialId: "gw-1",
        status: "PAID",
      });

      const managerBalance = await h.walletService.getBalance("manager-user");
      expect(managerBalance.main).toBe(0);
    });

    it("the spread is strictly a level-1 concept — level 2/3 never generate MANAGER_SPREAD rows", async () => {
      const h = buildAffiliateTestHarness();
      const { l2 } = await seedThreeLevelChain(h);
      const manager = await h.managers.create({ userId: "manager-user", inviteCode: "MGR004", commissionPercent: 90, status: "ACTIVE" });
      await h.affiliateService.assignManager(l2.id, manager.id);
      await h.settingsRepo.update({ revShareLevel1Percent: 0.1, revShareLevel2Percent: 0.05 });

      await h.commissionService.handleDepositConfirmed({
        depositId: "dep-level2-mgr",
        userId: "player",
        amountCents: 10000,
        gatewayCredentialId: "gw-1",
        status: "PAID",
      });

      const managerBalance = await h.walletService.getBalance("manager-user");
      expect(managerBalance.main).toBe(0); // no spread paid — l2 is not the level-1 ancestor
    });
  });
});
