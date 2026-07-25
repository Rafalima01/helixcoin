import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { buildPaymentTestHarness } from "@/modules/payments/tests/test-helpers";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";

const USER_ID = "user-withdraw-approve-1";
const ACTOR: WalletActor = { actorId: USER_ID, actorType: "USER" };

describe("PaymentService withdraw lifecycle — approve", () => {
  it("requestWithdraw locks funds, decideWithdraw(APPROVE) debits LOCKED and settles", async () => {
    const { paymentService, walletService, withdraws } = await buildPaymentTestHarness();

    await walletService.credit({
      userId: USER_ID,
      amountCents: 10000,
      type: "DEPOSIT",
      origin: "test-setup",
      idempotencyKey: "setup-credit-approve",
      actor: { actorId: null, actorType: "SYSTEM" },
    });

    const requested = await paymentService.requestWithdraw(USER_ID, 4000, "user@example.com", "EMAIL", ACTOR);
    expect(requested.status).toBe("PENDING");

    const afterLock = await walletService.getBalance(USER_ID);
    expect(afterLock.main).toBe(6000);
    expect(afterLock.locked).toBe(4000);

    const withdrawBeforeDecision = await withdraws.findById(requested.withdrawId);
    expect(withdrawBeforeDecision?.lockWalletTransactionId).toBeTruthy();

    const outcome = await paymentService.decideWithdraw(requested.withdrawId, "APPROVE", undefined);
    expect(outcome.status).toBe(200);

    const afterApprove = await walletService.getBalance(USER_ID);
    expect(afterApprove.main).toBe(6000);
    expect(afterApprove.locked).toBe(0);

    const withdraw = await withdraws.findById(requested.withdrawId);
    expect(withdraw?.status).toBe("APPROVED");
    expect(withdraw?.settleWalletTransactionId).toBeTruthy();

    const settleTx = await walletService.getTransactionById(withdraw!.settleWalletTransactionId!);
    expect(settleTx?.type).toBe("WITHDRAW_APPROVED");
    expect(settleTx?.account).toBe("LOCKED");
    expect(settleTx?.ledgerId).toBeTruthy();
  });

  it("requestWithdraw fails with insufficient MAIN balance and never creates a Withdraw row", async () => {
    const { paymentService, withdraws } = await buildPaymentTestHarness();
    await expect(paymentService.requestWithdraw(USER_ID, 5000, "user@example.com", "EMAIL", ACTOR)).rejects.toThrow();
    const { total } = await withdraws.listAdmin({ page: 1, pageSize: 10 });
    expect(total).toBe(0);
  });

  it("decideWithdraw on an already-approved withdraw is rejected as already-processed", async () => {
    const { paymentService, walletService } = await buildPaymentTestHarness();
    await walletService.credit({
      userId: USER_ID,
      amountCents: 5000,
      type: "DEPOSIT",
      origin: "test-setup",
      idempotencyKey: "setup-credit-approve-2",
      actor: { actorId: null, actorType: "SYSTEM" },
    });
    const requested = await paymentService.requestWithdraw(USER_ID, 2000, "user@example.com", "EMAIL", ACTOR);
    await paymentService.decideWithdraw(requested.withdrawId, "APPROVE", undefined);
    await expect(paymentService.decideWithdraw(requested.withdrawId, "APPROVE", undefined)).rejects.toThrow();
  });
});
