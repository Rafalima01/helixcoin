import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { buildPaymentTestHarness } from "@/modules/payments/tests/test-helpers";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";

const USER_ID = "user-withdraw-reject-1";
const ACTOR: WalletActor = { actorId: USER_ID, actorType: "USER" };

describe("PaymentService withdraw lifecycle — reject", () => {
  it("decideWithdraw(REJECT) unlocks funds back to MAIN and never debits", async () => {
    const { paymentService, walletService, withdraws } = await buildPaymentTestHarness();

    await walletService.credit({
      userId: USER_ID,
      amountCents: 8000,
      type: "DEPOSIT",
      origin: "test-setup",
      idempotencyKey: "setup-credit-reject",
      actor: { actorId: null, actorType: "SYSTEM" },
    });

    const requested = await paymentService.requestWithdraw(USER_ID, 3000, "11122233344", "CPF", ACTOR);
    const afterLock = await walletService.getBalance(USER_ID);
    expect(afterLock.main).toBe(5000);
    expect(afterLock.locked).toBe(3000);

    const outcome = await paymentService.decideWithdraw(requested.withdrawId, "REJECT", "Chave PIX inválida");
    expect(outcome.status).toBe(200);

    const afterReject = await walletService.getBalance(USER_ID);
    expect(afterReject.main).toBe(8000);
    expect(afterReject.locked).toBe(0);

    const withdraw = await withdraws.findById(requested.withdrawId);
    expect(withdraw?.status).toBe("REJECTED");
    expect(withdraw?.rejectionReason).toBe("Chave PIX inválida");
    expect(withdraw?.settleWalletTransactionId).toBeNull();
  });

  it("decideWithdraw requires a rejectionReason for REJECT at the validator level", async () => {
    const { adminWithdrawDecisionSchema } = await import("@/modules/payments/validators/payments.validator");
    const result = adminWithdrawDecisionSchema.safeParse({ action: "REJECT" });
    expect(result.success).toBe(false);
  });
});
