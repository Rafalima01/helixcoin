import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/modules/payments/providers/veopag/veopag-auth", () => ({
  VEOPAG_BASE_URL: "https://api.veopag.com",
  getVeoPagToken: vi.fn().mockResolvedValue("test-jwt-token"),
  invalidateVeoPagToken: vi.fn().mockResolvedValue(undefined),
}));

import { encrypt } from "@/server/security/crypto-utils";
import { buildPaymentTestHarness } from "@/modules/payments/tests/test-helpers";
import { PaymentReconciliationService } from "@/modules/payments/services/payment-reconciliation.service";

const STUCK_MINUTES = 11; // > PaymentReconciliationService's 10-minute threshold

function stubFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })
  );
}

describe("PaymentReconciliationService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("settles a stuck deposit once VeoPag reports it COMPLETED — idempotent on a repeated run", async () => {
    const harness = await buildPaymentTestHarness();
    const webhookSecret = "veopag-secret-x";
    const credential = await harness.credentials.create({
      name: "VeoPag",
      provider: "VEOPAG",
      active: true,
      priority: 1,
      credentialsEncrypted: encrypt(JSON.stringify({ publicKey: "cli", privateKey: "sec" })),
      webhookSecretEncrypted: encrypt(webhookSecret),
    });

    const deposit = await harness.deposits.create({
      id: "dep-stuck-1",
      userId: "user-recon-1",
      gatewayCredentialId: credential.id,
      amountCents: 10000,
      status: "PENDING",
      providerTransactionId: "veopag-tx-1",
    });

    // Advance the clock past the "stuck" threshold — findStuckPending compares against Date.now(), not a fixed value.
    vi.advanceTimersByTime(STUCK_MINUTES * 60_000);

    const reconciliation = new PaymentReconciliationService(
      harness.deposits,
      harness.withdraws,
      harness.credentials,
      harness.paymentService
    );

    stubFetchOnce(200, { deposit: { transaction_id: "veopag-tx-1", status: "COMPLETED", amount: 100 } });
    await reconciliation.reconcilePendingDeposits();

    const settled = await harness.deposits.findById(deposit.id);
    expect(settled?.status).toBe("PAID");
    expect((await harness.walletService.getBalance("user-recon-1")).main).toBe(10000);

    // Second run: the deposit is no longer PENDING, so findStuckPending won't
    // even surface it — proves no double-settlement regardless of how many
    // times the 5-minute job fires after the fact.
    stubFetchOnce(200, { deposit: { transaction_id: "veopag-tx-1", status: "COMPLETED", amount: 100 } });
    await reconciliation.reconcilePendingDeposits();
    expect((await harness.walletService.getBalance("user-recon-1")).main).toBe(10000);
  });

  it("leaves a still-PENDING deposit untouched", async () => {
    const harness = await buildPaymentTestHarness();
    const credential = await harness.credentials.create({
      name: "VeoPag",
      provider: "VEOPAG",
      active: true,
      priority: 1,
      credentialsEncrypted: encrypt(JSON.stringify({ publicKey: "cli", privateKey: "sec" })),
      webhookSecretEncrypted: encrypt("veopag-secret-y"),
    });
    const deposit = await harness.deposits.create({
      id: "dep-stuck-2",
      userId: "user-recon-2",
      gatewayCredentialId: credential.id,
      amountCents: 5000,
      status: "PENDING",
      providerTransactionId: "veopag-tx-2",
    });
    vi.advanceTimersByTime(STUCK_MINUTES * 60_000);

    const reconciliation = new PaymentReconciliationService(
      harness.deposits,
      harness.withdraws,
      harness.credentials,
      harness.paymentService
    );
    stubFetchOnce(200, { deposit: { transaction_id: "veopag-tx-2", status: "PENDING", amount: 50 } });
    await reconciliation.reconcilePendingDeposits();

    expect((await harness.deposits.findById(deposit.id))?.status).toBe("PENDING");
  });

  it("ignores deposits on non-VeoPag gateways (MOCK never independently changes status)", async () => {
    const harness = await buildPaymentTestHarness();
    const deposit = await harness.deposits.create({
      id: "dep-mock-1",
      userId: "user-recon-3",
      gatewayCredentialId: harness.credential.id, // the MOCK credential the harness pre-registers
      amountCents: 2000,
      status: "PENDING",
      providerTransactionId: "mock_dep_dep-mock-1",
    });
    vi.advanceTimersByTime(STUCK_MINUTES * 60_000);

    const reconciliation = new PaymentReconciliationService(
      harness.deposits,
      harness.withdraws,
      harness.credentials,
      harness.paymentService
    );
    // No fetch stub at all — a real network call here would fail the test, proving MOCK deposits never reach the HTTP layer.
    await reconciliation.reconcilePendingDeposits();

    expect((await harness.deposits.findById(deposit.id))?.status).toBe("PENDING");
  });
});
