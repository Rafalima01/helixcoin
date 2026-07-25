import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";
import { buildPaymentTestHarness, MOCK_WEBHOOK_SECRET } from "@/modules/payments/tests/test-helpers";

const USER_ID = "user-webhook-idem-1";

describe("PaymentService.handleWebhook — idempotency", () => {
  it("replaying the exact same signed delivery twice credits the wallet exactly once", async () => {
    const { paymentService, walletService, deposits, credential } = await buildPaymentTestHarness();
    const created = await paymentService.createDeposit(USER_ID, 4000);
    const deposit = await deposits.findById(created.depositId);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: deposit!.id,
      providerTransactionId: deposit!.providerTransactionId!,
      webhookSecret: MOCK_WEBHOOK_SECRET,
    });

    const first = await paymentService.handleWebhook(credential.provider, built.rawBody, built.signatureHeader);
    const second = await paymentService.handleWebhook(credential.provider, built.rawBody, built.signatureHeader);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const balance = await walletService.getBalance(USER_ID);
    expect(balance.main).toBe(4000);
  });

  it("falls back to payloadHash dedup when the provider supplies no providerEventId at all", async () => {
    const { paymentService, walletService, deposits, credential } = await buildPaymentTestHarness();
    const created = await paymentService.createDeposit(USER_ID, 1500);
    const deposit = await deposits.findById(created.depositId);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: deposit!.id,
      providerTransactionId: deposit!.providerTransactionId!,
      webhookSecret: MOCK_WEBHOOK_SECRET,
    });

    // Strip the eventId out of the payload/signature to simulate a provider that never sends one — payloadHash is then the only dedup key.
    const payloadWithoutEventId = JSON.parse(built.rawBody);
    delete payloadWithoutEventId.eventId;
    const rawBody = JSON.stringify(payloadWithoutEventId);
    const { createHmac } = await import("node:crypto");
    const signatureHeader = createHmac("sha256", MOCK_WEBHOOK_SECRET).update(rawBody).digest("hex");

    await paymentService.handleWebhook(credential.provider, rawBody, signatureHeader);
    await paymentService.handleWebhook(credential.provider, rawBody, signatureHeader);

    const balance = await walletService.getBalance(USER_ID);
    expect(balance.main).toBe(1500);
  });
});
