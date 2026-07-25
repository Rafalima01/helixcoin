import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";
import { buildPaymentTestHarness, MOCK_WEBHOOK_SECRET } from "@/modules/payments/tests/test-helpers";

const USER_ID = "user-webhook-sig-1";

describe("PaymentService.handleWebhook — signature validation", () => {
  it("a validly signed deposit.paid webhook settles and credits the wallet", async () => {
    const { paymentService, walletService, deposits, credential } = await buildPaymentTestHarness();
    const created = await paymentService.createDeposit(USER_ID, 2500);
    const deposit = await deposits.findById(created.depositId);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: deposit!.id,
      providerTransactionId: deposit!.providerTransactionId!,
      webhookSecret: MOCK_WEBHOOK_SECRET,
    });

    const outcome = await paymentService.handleWebhook(credential.provider, built.rawBody, built.signatureHeader);
    expect(outcome.status).toBe(200);

    const balance = await walletService.getBalance(USER_ID);
    expect(balance.main).toBe(2500);
  });

  it("an invalid signature is rejected with no side effects (deposit stays PENDING, wallet untouched)", async () => {
    const { paymentService, walletService, deposits, credential } = await buildPaymentTestHarness();
    const created = await paymentService.createDeposit(USER_ID, 2500);
    const deposit = await deposits.findById(created.depositId);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: deposit!.id,
      providerTransactionId: deposit!.providerTransactionId!,
      webhookSecret: "wrong-secret-entirely",
    });

    await expect(
      paymentService.handleWebhook(credential.provider, built.rawBody, built.signatureHeader)
    ).rejects.toThrow();

    const balance = await walletService.getBalance(USER_ID);
    expect(balance.main).toBe(0);
    const untouchedDeposit = await deposits.findById(created.depositId);
    expect(untouchedDeposit?.status).toBe("PENDING");
  });

  it("a missing signature header is rejected", async () => {
    const { paymentService, credential } = await buildPaymentTestHarness();
    await expect(
      paymentService.handleWebhook(credential.provider, '{"eventType":"deposit.paid"}', null)
    ).rejects.toThrow();
  });
});
