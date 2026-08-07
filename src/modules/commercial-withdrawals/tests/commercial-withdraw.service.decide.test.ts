import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/notifications", () => ({
  NotificationService: { notify: vi.fn() },
  NOTIFICATION_TYPES: { withdrawApproved: "withdraw_approved", withdrawRejected: "withdraw_rejected" },
}));

import { BusinessRuleError, NotFoundError, ValidationError } from "@/server/errors";
import { buildCommercialWithdrawTestHarness, seedUserWithBalance } from "@/modules/commercial-withdrawals/tests/test-helpers";

const ADMIN_ACTOR = { id: "admin-1", role: "ADMIN" as const };
const META = { ip: null, userAgent: null };

async function seedPendingWithdraw(h: Awaited<ReturnType<typeof buildCommercialWithdrawTestHarness>>, amountCents = 3000) {
  const userId = await seedUserWithBalance(h, { amountCents: 10_000 });
  const pixKey = await h.pixKeys.create({ userId, type: "EMAIL", keyEncrypted: "enc:test@example.com", holderCpf: "12345678901" });
  const withdraw = await h.commercialWithdrawService.request({
    userId,
    payeeRole: "AFFILIATE",
    amountCents,
    pixKeyId: pixKey.id,
    actor: { actorId: userId, actorType: "USER" },
  });
  return { userId, withdraw };
}

describe("CommercialWithdrawService.decide — approve", () => {
  it("debits LOCKED, status -> APPROVED, WalletService.debit called with the deterministic idempotencyKey", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const { userId, withdraw } = await seedPendingWithdraw(h, 3000);
    const debitSpy = vi.spyOn(h.walletService, "debit");

    const decided = await h.commercialWithdrawService.decide({
      id: withdraw.id,
      action: "APPROVE",
      actor: ADMIN_ACTOR,
      meta: META,
    });

    expect(decided.status).toBe("APPROVED");
    expect(decided.settleWalletTransactionId).toBeTruthy();

    expect(debitSpy).toHaveBeenCalledTimes(1);
    expect(debitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        amountCents: 3000,
        account: "LOCKED",
        idempotencyKey: `commercial-withdraw:${withdraw.id}:approve`,
      })
    );

    const balance = await h.walletService.getBalance(userId);
    expect(balance.locked).toBe(0);
    expect(balance.main).toBe(7000);
  });

  it("approving an already-APPROVED id throws BusinessRuleError and does NOT call WalletService.debit again", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const { withdraw } = await seedPendingWithdraw(h, 1000);
    await h.commercialWithdrawService.decide({ id: withdraw.id, action: "APPROVE", actor: ADMIN_ACTOR, meta: META });

    const debitSpy = vi.spyOn(h.walletService, "debit");
    await expect(
      h.commercialWithdrawService.decide({ id: withdraw.id, action: "APPROVE", actor: ADMIN_ACTOR, meta: META })
    ).rejects.toThrow(BusinessRuleError);
    expect(debitSpy).not.toHaveBeenCalled();
  });

  it("approving an already-REJECTED id throws BusinessRuleError and does NOT call WalletService.debit", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const { withdraw } = await seedPendingWithdraw(h, 1000);
    await h.commercialWithdrawService.decide({
      id: withdraw.id,
      action: "REJECT",
      rejectionReason: "chave inválida",
      actor: ADMIN_ACTOR,
      meta: META,
    });

    const debitSpy = vi.spyOn(h.walletService, "debit");
    await expect(
      h.commercialWithdrawService.decide({ id: withdraw.id, action: "APPROVE", actor: ADMIN_ACTOR, meta: META })
    ).rejects.toThrow(BusinessRuleError);
    expect(debitSpy).not.toHaveBeenCalled();
  });

  it("decide() on an unknown id throws NotFoundError", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    await expect(
      h.commercialWithdrawService.decide({ id: "nonexistent", action: "APPROVE", actor: ADMIN_ACTOR, meta: META })
    ).rejects.toThrow(NotFoundError);
  });
});

describe("CommercialWithdrawService.decide — reject", () => {
  it("unlocks to MAIN, status -> REJECTED", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const { userId, withdraw } = await seedPendingWithdraw(h, 2500);
    const unlockSpy = vi.spyOn(h.walletService, "unlock");

    const decided = await h.commercialWithdrawService.decide({
      id: withdraw.id,
      action: "REJECT",
      rejectionReason: "chave PIX inválida",
      actor: ADMIN_ACTOR,
      meta: META,
    });

    expect(decided.status).toBe("REJECTED");
    expect(decided.rejectionReason).toBe("chave PIX inválida");
    expect(unlockSpy).toHaveBeenCalledTimes(1);
    expect(unlockSpy).toHaveBeenCalledWith(
      expect.objectContaining({ userId, amountCents: 2500, idempotencyKey: `commercial-withdraw:${withdraw.id}:unlock-reject` })
    );

    const balance = await h.walletService.getBalance(userId);
    expect(balance.locked).toBe(0);
    expect(balance.main).toBe(10_000);
  });

  it("requires a non-empty rejectionReason", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const { withdraw } = await seedPendingWithdraw(h, 1000);
    await expect(
      h.commercialWithdrawService.decide({ id: withdraw.id, action: "REJECT", actor: ADMIN_ACTOR, meta: META })
    ).rejects.toThrow(ValidationError);
  });

  it("rejecting an already-decided id throws BusinessRuleError and does NOT call WalletService.unlock again", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const { withdraw } = await seedPendingWithdraw(h, 1000);
    await h.commercialWithdrawService.decide({
      id: withdraw.id,
      action: "REJECT",
      rejectionReason: "motivo",
      actor: ADMIN_ACTOR,
      meta: META,
    });

    const unlockSpy = vi.spyOn(h.walletService, "unlock");
    await expect(
      h.commercialWithdrawService.decide({
        id: withdraw.id,
        action: "REJECT",
        rejectionReason: "motivo 2",
        actor: ADMIN_ACTOR,
        meta: META,
      })
    ).rejects.toThrow(BusinessRuleError);
    expect(unlockSpy).not.toHaveBeenCalled();
  });
});

describe("CommercialWithdrawService.decide — concurrency (the safety-critical invariant)", () => {
  it("simultaneous APPROVE and REJECT on the SAME PENDING id: exactly one wins, the other throws BusinessRuleError, and the final wallet state matches whichever one won", async () => {
    const h = await buildCommercialWithdrawTestHarness();
    const { userId, withdraw } = await seedPendingWithdraw(h, 4000);

    const [approveResult, rejectResult] = await Promise.allSettled([
      h.commercialWithdrawService.decide({ id: withdraw.id, action: "APPROVE", actor: ADMIN_ACTOR, meta: META }),
      h.commercialWithdrawService.decide({
        id: withdraw.id,
        action: "REJECT",
        rejectionReason: "concurrent reject attempt",
        actor: ADMIN_ACTOR,
        meta: META,
      }),
    ]);

    const outcomes = [approveResult, rejectResult];
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
    const rejectedOutcomes = outcomes.filter((o) => o.status === "rejected");

    // Exactly one of the two decide() calls wins.
    expect(fulfilled).toHaveLength(1);
    expect(rejectedOutcomes).toHaveLength(1);
    expect((rejectedOutcomes[0] as PromiseRejectedResult).reason).toBeInstanceOf(BusinessRuleError);

    const finalWithdraw = await h.commercialWithdraws.findById(withdraw.id);
    const balance = await h.walletService.getBalance(userId);

    if (approveResult.status === "fulfilled") {
      // APPROVE won: funds left LOCKED via a debit, never returned to MAIN.
      expect(finalWithdraw?.status).toBe("APPROVED");
      expect(balance.locked).toBe(0);
      expect(balance.main).toBe(6000); // 10000 - 4000 debited
    } else {
      // REJECT won: funds returned to MAIN, nothing debited out of the system.
      expect(finalWithdraw?.status).toBe("REJECTED");
      expect(balance.locked).toBe(0);
      expect(balance.main).toBe(10_000); // fully unlocked back
    }

    // No double-movement either way: locked bucket is drained to zero exactly once, main balance is one of the two possible values, never negative or double-counted.
    expect(balance.locked).toBe(0);
    expect(finalWithdraw?.settleWalletTransactionId).toBeTruthy();
  });
});
