import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { buildPaymentTestHarness } from "@/modules/payments/tests/test-helpers";

const USER_ID = "user-deposit-1";

describe("PaymentService deposit lifecycle", () => {
  it("createDeposit -> simulateDeposit(PAID) credits the wallet and writes a matching Ledger pair", async () => {
    const { paymentService, walletService, deposits, credential } = await buildPaymentTestHarness();

    const created = await paymentService.createDeposit(USER_ID, 5000);
    expect(created.status).toBe("PENDING");
    expect(created.pixCode).toBeTruthy();

    const beforeBalance = await walletService.getBalance(USER_ID);
    expect(beforeBalance.main).toBe(0);

    const outcome = await paymentService.simulateDeposit(created.depositId, USER_ID, "PAID");
    expect(outcome.status).toBe(200);

    const afterBalance = await walletService.getBalance(USER_ID);
    expect(afterBalance.main).toBe(5000);

    const deposit = await deposits.findById(created.depositId);
    expect(deposit?.status).toBe("PAID");
    expect(deposit?.walletTransactionId).toBeTruthy();
    expect(deposit?.gatewayCredentialId).toBe(credential.id);

    const tx = await walletService.getTransactionById(deposit!.walletTransactionId!);
    expect(tx?.type).toBe("DEPOSIT");
    expect(tx?.amount).toBe(5000);
    expect(tx?.ledgerId).toBeTruthy();
  });

  it("createDeposit -> simulateDeposit(FAILED) never touches the wallet", async () => {
    const { paymentService, walletService, deposits } = await buildPaymentTestHarness();

    const created = await paymentService.createDeposit(USER_ID, 3000);
    await paymentService.simulateDeposit(created.depositId, USER_ID, "FAILED");

    const balance = await walletService.getBalance(USER_ID);
    expect(balance.main).toBe(0);

    const deposit = await deposits.findById(created.depositId);
    expect(deposit?.status).toBe("FAILED");
    expect(deposit?.walletTransactionId).toBeNull();
  });

  it("getDeposit throws Forbidden for a different user", async () => {
    const { paymentService } = await buildPaymentTestHarness();
    const created = await paymentService.createDeposit(USER_ID, 1000);
    await expect(paymentService.getDeposit(created.depositId, "someone-else")).rejects.toThrow();
  });

  it("rejects an amount below PaymentSettings.depositMinCents", async () => {
    const { paymentService, settingsRepo } = await buildPaymentTestHarness();
    await settingsRepo.update({ depositMinCents: 1000 });
    await expect(paymentService.createDeposit(USER_ID, 100)).rejects.toThrow();
  });
});

describe("PaymentService.simulateDepositAdmin (Fase 10)", () => {
  it("CANCELLED and EXPIRED transition the deposit without touching the wallet", async () => {
    const { paymentService, walletService, deposits } = await buildPaymentTestHarness();

    const cancelled = await paymentService.createDeposit(USER_ID, 2000);
    await paymentService.simulateDepositAdmin(cancelled.depositId, "CANCELLED");
    expect((await deposits.findById(cancelled.depositId))?.status).toBe("CANCELLED");

    const expired = await paymentService.createDeposit(USER_ID, 2000);
    await paymentService.simulateDepositAdmin(expired.depositId, "EXPIRED");
    expect((await deposits.findById(expired.depositId))?.status).toBe("EXPIRED");

    expect((await walletService.getBalance(USER_ID)).main).toBe(0);
  });

  it("REFUNDED only works on an already-PAID deposit, only changes status, never debits the wallet", async () => {
    const { paymentService, walletService, deposits } = await buildPaymentTestHarness();
    const created = await paymentService.createDeposit(USER_ID, 6000);

    // Not paid yet — refund must be rejected, exactly like an out-of-scope status transition.
    await expect(paymentService.simulateDepositAdmin(created.depositId, "REFUNDED")).rejects.toThrow();

    await paymentService.simulateDepositAdmin(created.depositId, "PAID");
    expect((await walletService.getBalance(USER_ID)).main).toBe(6000);

    await paymentService.simulateDepositAdmin(created.depositId, "REFUNDED");
    const deposit = await deposits.findById(created.depositId);
    expect(deposit?.status).toBe("REFUNDED");

    // No automatic wallet clawback by design — see PaymentService.settle's doc comment.
    expect((await walletService.getBalance(USER_ID)).main).toBe(6000);
  });

  it("rejects PAID/FAILED/CANCELLED/EXPIRED outcomes on a deposit that isn't PENDING", async () => {
    const { paymentService } = await buildPaymentTestHarness();
    const created = await paymentService.createDeposit(USER_ID, 1000);
    await paymentService.simulateDepositAdmin(created.depositId, "PAID");

    await expect(paymentService.simulateDepositAdmin(created.depositId, "FAILED")).rejects.toThrow();
    await expect(paymentService.simulateDepositAdmin(created.depositId, "CANCELLED")).rejects.toThrow();
    await expect(paymentService.simulateDepositAdmin(created.depositId, "EXPIRED")).rejects.toThrow();
  });
});
