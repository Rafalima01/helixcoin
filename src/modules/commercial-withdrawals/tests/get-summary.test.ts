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
 * Backs the "Saques Comerciais" admin page's summary cards (Saques
 * pendentes / Total solicitado / Total pago / Quantidade de solicitações).
 * APPROVED is treated as "pago" by design — this architecture debits the
 * wallet synchronously on approve, there is no separate PAID/PROCESSING
 * status (see CommercialWithdrawService.decide's doc comment).
 */
describe("ICommercialWithdrawRepository.getSummary", () => {
  it("splits pendingCents/paidCents correctly and sums every status into totalRequestedCents/count", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { amountCents: 100_000 });
    const pixKey = await h.pixKeys.create({ userId, type: "EMAIL", keyEncrypted: "enc:a@example.com", holderCpf: "12345678901" });

    // PENDING — counts toward pendingCents and totalRequestedCents.
    await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 1000,
      pixKeyId: pixKey.id,
      actor: { actorId: userId, actorType: "USER" },
    });

    // APPROVED — counts toward paidCents and totalRequestedCents, NOT pendingCents.
    const w2 = await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 2000,
      pixKeyId: pixKey.id,
      actor: { actorId: userId, actorType: "USER" },
    });
    await h.commercialWithdrawService.decide({ id: w2.id, action: "APPROVE", actor: ADMIN_ACTOR, meta: META });

    // REJECTED — counts toward totalRequestedCents only.
    const w3 = await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 4000,
      pixKeyId: pixKey.id,
      actor: { actorId: userId, actorType: "USER" },
    });
    await h.commercialWithdrawService.decide({ id: w3.id, action: "REJECT", rejectionReason: "teste", actor: ADMIN_ACTOR, meta: META });

    const summary = await h.commercialWithdraws.getSummary({});
    expect(summary.pendingCents).toBe(1000);
    expect(summary.paidCents).toBe(2000);
    expect(summary.totalRequestedCents).toBe(1000 + 2000 + 4000);
    expect(summary.count).toBe(3);
  });

  it("respects payeeRole filter — a MANAGER request never bleeds into an AFFILIATE-scoped summary", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const affiliateUserId = await seedUserWithBalance(h, { amountCents: 100_000 });
    const managerUserId = await seedUserWithBalance(h, { amountCents: 100_000 });
    const affiliatePixKey = await h.pixKeys.create({ userId: affiliateUserId, type: "EMAIL", keyEncrypted: "enc:a@example.com", holderCpf: "12345678901" });
    const managerPixKey = await h.pixKeys.create({ userId: managerUserId, type: "EMAIL", keyEncrypted: "enc:b@example.com", holderCpf: "98765432100" });

    await h.commercialWithdrawService.request({
      userId: affiliateUserId,
      payeeRole: "AFFILIATE",
      amountCents: 1500,
      pixKeyId: affiliatePixKey.id,
      actor: { actorId: affiliateUserId, actorType: "USER" },
    });
    await h.commercialWithdrawService.request({
      userId: managerUserId,
      payeeRole: "MANAGER",
      amountCents: 9999,
      pixKeyId: managerPixKey.id,
      actor: { actorId: managerUserId, actorType: "USER" },
    });

    const affiliateSummary = await h.commercialWithdraws.getSummary({ payeeRole: "AFFILIATE" });
    expect(affiliateSummary.totalRequestedCents).toBe(1500);
    expect(affiliateSummary.count).toBe(1);

    const managerSummary = await h.commercialWithdraws.getSummary({ payeeRole: "MANAGER" });
    expect(managerSummary.totalRequestedCents).toBe(9999);
    expect(managerSummary.count).toBe(1);
  });

  it("respects userIdIn (the resolved 'Vínculo' filter) — only requests from the given users are summed", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const included = await seedUserWithBalance(h, { amountCents: 100_000 });
    const excluded = await seedUserWithBalance(h, { amountCents: 100_000 });
    const includedPixKey = await h.pixKeys.create({ userId: included, type: "EMAIL", keyEncrypted: "enc:a@example.com", holderCpf: "12345678901" });
    const excludedPixKey = await h.pixKeys.create({ userId: excluded, type: "EMAIL", keyEncrypted: "enc:b@example.com", holderCpf: "98765432100" });

    await h.commercialWithdrawService.request({
      userId: included,
      payeeRole: "AFFILIATE",
      amountCents: 700,
      pixKeyId: includedPixKey.id,
      actor: { actorId: included, actorType: "USER" },
    });
    await h.commercialWithdrawService.request({
      userId: excluded,
      payeeRole: "AFFILIATE",
      amountCents: 8000,
      pixKeyId: excludedPixKey.id,
      actor: { actorId: excluded, actorType: "USER" },
    });

    const summary = await h.commercialWithdraws.getSummary({ userIdIn: [included] });
    expect(summary.totalRequestedCents).toBe(700);
    expect(summary.count).toBe(1);
  });

  it("respects from/to (createdAt range)", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const userId = await seedUserWithBalance(h, { amountCents: 100_000 });
    const pixKey = await h.pixKeys.create({ userId, type: "EMAIL", keyEncrypted: "enc:a@example.com", holderCpf: "12345678901" });

    await h.commercialWithdrawService.request({
      userId,
      payeeRole: "AFFILIATE",
      amountCents: 500,
      pixKeyId: pixKey.id,
      actor: { actorId: userId, actorType: "USER" },
    });

    const future = new Date(Date.now() + 60_000);
    const summaryOutsideWindow = await h.commercialWithdraws.getSummary({ from: future });
    expect(summaryOutsideWindow.count).toBe(0);

    const past = new Date(Date.now() - 60_000);
    const summaryInsideWindow = await h.commercialWithdraws.getSummary({ from: past });
    expect(summaryInsideWindow.count).toBe(1);
  });

  it("returns all zeros when nothing matches", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const summary = await h.commercialWithdraws.getSummary({});
    expect(summary).toEqual({ pendingCents: 0, totalRequestedCents: 0, paidCents: 0, count: 0 });
  });
});
