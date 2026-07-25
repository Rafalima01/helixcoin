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
