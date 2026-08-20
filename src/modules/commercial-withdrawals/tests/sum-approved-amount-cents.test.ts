import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/notifications", () => ({
  NotificationService: { notify: vi.fn() },
  NOTIFICATION_TYPES: { withdrawApproved: "withdraw_approved", withdrawRejected: "withdraw_rejected" },
}));

import { buildCommercialWithdrawTestHarness, seedUserWithBalance } from "@/modules/commercial-withdrawals/tests/test-helpers";

const ADMIN_ACTOR = { id: "admin-1", role: "ADMIN" as const };
const META = { ip: null, userAgent: null };

/**
 * Backs the "Comissão paga" figure on the admin Afiliados performance view
 * (affiliate-admin.controller.ts's handleGetAffiliatePerformanceAdmin) — only
 * an APPROVED CommercialWithdraw represents money that actually left the
 * platform to the affiliate. PENDING/REJECTED must never count.
 */
describe("ICommercialWithdrawRepository.sumApprovedAmountCents", () => {
  it("sums only APPROVED withdrawals for the given user + payeeRole, ignoring PENDING/REJECTED and other users", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { amountCents: 100_000 });
    const otherUserId = await seedUserWithBalance(h, { amountCents: 100_000 });
    const pixKey = await h.pixKeys.create({ userId, type: "EMAIL", keyEncrypted: "enc:a@example.com", holderCpf: "12345678901" });
    const otherPixKey = await h.pixKeys.create({ userId: otherUserId, type: "EMAIL", keyEncrypted: "enc:b@example.com", holderCpf: "98765432100" });

    // Approved — counts.
    const w1 = await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 4000,
      pixKeyId: pixKey.id,
      actor: { actorId: userId, actorType: "USER" },
    });
    await h.commercialWithdrawService.decide({ id: w1.id, action: "APPROVE", actor: ADMIN_ACTOR, meta: META });

    // Also approved — counts, sums with the first.
    const w2 = await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 1500,
      pixKeyId: pixKey.id,
      actor: { actorId: userId, actorType: "USER" },
    });
    await h.commercialWithdrawService.decide({ id: w2.id, action: "APPROVE", actor: ADMIN_ACTOR, meta: META });

    // Still PENDING — must NOT count as paid.
    await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 9999,
      pixKeyId: pixKey.id,
      actor: { actorId: userId, actorType: "USER" },
    });

    // Rejected — must NOT count as paid.
    const w4 = await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 777,
      pixKeyId: pixKey.id,
      actor: { actorId: userId, actorType: "USER" },
    });
    await h.commercialWithdrawService.decide({ id: w4.id, action: "REJECT", rejectionReason: "teste", actor: ADMIN_ACTOR, meta: META });

    // A different user's approved withdrawal — must NOT bleed into this user's total.
    const otherWithdraw = await h.commercialWithdrawService.request({
      userId: otherUserId,
      payeeRole: "AFFILIATE",
      amountCents: 5000,
      pixKeyId: otherPixKey.id,
      actor: { actorId: otherUserId, actorType: "USER" },
    });
    await h.commercialWithdrawService.decide({ id: otherWithdraw.id, action: "APPROVE", actor: ADMIN_ACTOR, meta: META });

    const paid = await h.commercialWithdraws.sumApprovedAmountCents(userId, "AFFILIATE");
    expect(paid).toBe(5500); // 4000 + 1500, excludes PENDING/REJECTED/other user

    const otherPaid = await h.commercialWithdraws.sumApprovedAmountCents(otherUserId, "AFFILIATE");
    expect(otherPaid).toBe(5000);
  });

  it("returns 0 when the user has never had an approved withdrawal", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const paid = await h.commercialWithdraws.sumApprovedAmountCents("nobody", "AFFILIATE");
    expect(paid).toBe(0);
  });
});
