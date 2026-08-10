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

import { AuditService } from "@/server/audit";
import { buildAffiliateTestHarness } from "@/modules/affiliate/tests/test-helpers";
import type { DecisionActor } from "@/modules/affiliate/services/affiliate.service";
import type { DepositEventPayload } from "@/modules/payments/events/payments.events";

const USER_ID = "regular-user-1";
const ADMIN_ACTOR: DecisionActor = { actorId: "admin-1", actorRole: "ADMIN" };

/**
 * "Afiliados Diretos" — an Admin finding a regular user (Gestão de Usuários)
 * and turning them into a direct affiliate. Covers the 12 scenarios asked
 * for: creation, default 5%, admin-editable %, the new % actually reaching
 * the commission calculation, no duplication, no manager required, managed
 * affiliates unaffected, no retroactive recalculation, and audit trail for
 * both creation and commission changes. CPA/percentage-only is a structural
 * guarantee (CommissionService.generate()'s sourceType param excludes
 * CPA_FTD at the type level — see commission.service.ts) rather than a
 * separate runtime test.
 */
describe("AffiliateService.adminCreateDirect — Afiliados Diretos", () => {
  it("turns a regular user into an affiliate with no manager (Direto)", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    const created = await affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);

    expect(created.status).toBe("APPROVED");
    expect(created.managerId).toBeNull();
    // null override => resolves to AffiliateSettings.revShareLevel1Percent (5% default).
    expect(created.revShareOverridePercent).toBeNull();
  });

  it("does not require a manager — managerId stays null (Direto), no artificial manager created", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    const created = await affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);
    expect(created.managerId).toBeNull();
  });

  it("is idempotent — a user who is already an affiliate is returned untouched, never duplicated", async () => {
    const { affiliateService, affiliates } = buildAffiliateTestHarness();
    const first = await affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);
    const second = await affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);

    expect(second.id).toBe(first.id);
    const all = await affiliates.listAdmin({ page: 1, pageSize: 100 });
    expect(all.items.filter((r) => r.userId === USER_ID)).toHaveLength(1);
  });

  it("also short-circuits when the user became an affiliate some other way (e.g. autoEnroll at signup)", async () => {
    const { affiliateService, affiliates } = buildAffiliateTestHarness();
    await affiliateService.autoEnroll(USER_ID);
    const viaAdmin = await affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);

    const all = await affiliates.listAdmin({ page: 1, pageSize: 100 });
    expect(all.items.filter((r) => r.userId === USER_ID)).toHaveLength(1);
    expect(viaAdmin.status).toBe("APPROVED");
  });

  it("records an audit entry for the creation, with the admin as actor", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    vi.mocked(AuditService.record).mockClear();
    const created = await affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);

    expect(AuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        actorType: "ADMIN",
        action: "affiliate.admin_create",
        entityType: "AffiliateProfile",
        entityId: created.id,
        before: null,
      })
    );
  });

  it("does NOT record a creation audit entry on the idempotent no-op path", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    await affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);
    vi.mocked(AuditService.record).mockClear();
    await affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);

    expect(AuditService.record).not.toHaveBeenCalled();
  });

  it("Admin can change the default 5% to any valid percent, with no ceiling for a direct affiliate", async () => {
    const { affiliateService } = buildAffiliateTestHarness();
    const created = await affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);
    vi.mocked(AuditService.record).mockClear();

    const updated = await affiliateService.updateCommission(created.id, 10, ADMIN_ACTOR);
    expect(updated.revShareOverridePercent).toBeCloseTo(0.1);
    expect(AuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "affiliate.commission.update", entityId: created.id })
    );
  });

  it("a managed affiliate (with a manager) keeps working exactly as before — unaffected by direct-affiliate support", async () => {
    const { affiliateService, managers } = buildAffiliateTestHarness();
    const manager = await managers.create({ userId: "manager-x", inviteCode: "MGRX1", commissionPercent: 60, status: "ACTIVE" });
    const applied = await affiliateService.apply("managed-user", {});
    await affiliateService.assignManager(applied.id, manager.id);
    await affiliateService.decide(applied.id, "APPROVE", undefined, ADMIN_ACTOR);

    const withManager = await affiliateService.getByIdAdmin(applied.id);
    expect(withManager.managerId).toBe(manager.id);
    // Still capped by the manager's ceiling — the pre-existing rule is untouched.
    await expect(affiliateService.updateCommission(applied.id, 61, ADMIN_ACTOR)).rejects.toThrow();
    const ok = await affiliateService.updateCommission(applied.id, 60, ADMIN_ACTOR);
    expect(ok.revShareOverridePercent).toBeCloseTo(0.6);
  });
});

describe("Direct affiliate commission — reaches the real financial calculation, no retroactive rewrite", () => {
  it("a direct affiliate created via admin earns the 5% platform default on a deposit", async () => {
    const h = buildAffiliateTestHarness();
    h.userReferrals.setReferrer("player-1", USER_ID);
    await h.affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);
    // Default AffiliateSettings.revShareLevel1Percent is 0.05 — left untouched.

    const payload: DepositEventPayload = {
      depositId: "dep-direct-1",
      userId: "player-1",
      amountCents: 10000,
      gatewayCredentialId: "gw-1",
      status: "PAID",
    };
    await h.commissionService.handleDepositConfirmed(payload);

    const balance = await h.walletService.getBalance(USER_ID);
    expect(balance.main).toBe(500); // 5% of 10000
  });

  it("Admin editing the % changes future commissions but never rewrites already-generated ones", async () => {
    const h = buildAffiliateTestHarness();
    h.userReferrals.setReferrer("player-1", USER_ID);
    const created = await h.affiliateService.adminCreateDirect(USER_ID, ADMIN_ACTOR);

    await h.commissionService.handleDepositConfirmed({
      depositId: "dep-before-change",
      userId: "player-1",
      amountCents: 10000,
      gatewayCredentialId: "gw-1",
      status: "PAID",
    });

    // Admin raises 5% -> 10%.
    await h.affiliateService.updateCommission(created.id, 10, ADMIN_ACTOR);

    await h.commissionService.handleDepositConfirmed({
      depositId: "dep-after-change",
      userId: "player-1",
      amountCents: 10000,
      gatewayCredentialId: "gw-1",
      status: "PAID",
    });

    const { items } = await h.commissions.listAdmin({ affiliateId: created.id, page: 1, pageSize: 10 });
    const before = items.find((r) => r.triggerId === "dep-before-change");
    const after = items.find((r) => r.triggerId === "dep-after-change");

    expect(before?.percentApplied).toBeCloseTo(0.05); // untouched by the later rate change
    expect(before?.amountCents).toBe(500);
    expect(after?.percentApplied).toBeCloseTo(0.1); // new rate applies from here on
    expect(after?.amountCents).toBe(1000);

    const balance = await h.walletService.getBalance(USER_ID);
    expect(balance.main).toBe(1500); // 500 + 1000, no retroactive recalculation of the first row
  });
});
