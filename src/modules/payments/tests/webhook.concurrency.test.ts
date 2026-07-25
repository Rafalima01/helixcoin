import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";
import { buildPaymentTestHarness, MOCK_WEBHOOK_SECRET } from "@/modules/payments/tests/test-helpers";

const USER_ID = "user-webhook-concurrency-1";

describe("PaymentService.handleWebhook — concurrency", () => {
  it("two concurrent identical webhook deliveries result in exactly one real credit, with the loser recovering via WebhookConflictError instead of erroring the request", async () => {
    const { paymentService, walletService, deposits, credential } = await buildPaymentTestHarness();
    const created = await paymentService.createDeposit(USER_ID, 6000);
    const deposit = await deposits.findById(created.depositId);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: deposit!.id,
      providerTransactionId: deposit!.providerTransactionId!,
      webhookSecret: MOCK_WEBHOOK_SECRET,
    });

    const [first, second] = await Promise.all([
      paymentService.handleWebhook(credential.provider, built.rawBody, built.signatureHeader),
      paymentService.handleWebhook(credential.provider, built.rawBody, built.signatureHeader),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    // The real invariant: exactly one credit happened, regardless of which concurrent call "won" the PaymentWebhook row race.
    const balance = await walletService.getBalance(USER_ID);
    expect(balance.main).toBe(6000);

    const finalDeposit = await deposits.findById(created.depositId);
    expect(finalDeposit?.status).toBe("PAID");
  });
});
