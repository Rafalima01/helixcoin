import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";
import { buildPaymentTestHarness } from "@/modules/payments/tests/test-helpers";

const USER_ID = "user-log-redaction-1";
const SECRET_NEEDLE = "super-secret-webhook-value-should-never-leak";

describe("GatewayLog redaction", () => {
  it("never logs the gateway's webhook secret across a full deposit + webhook lifecycle", async () => {
    const { paymentService, credentials, logs, credential, deposits } = await buildPaymentTestHarness();

    // Re-register the credential with a deliberately-identifiable secret, so any leak into GatewayLog is unmistakable.
    const { encrypt } = await import("@/server/security/crypto-utils");
    await credentials.update(credential.id, { webhookSecretEncrypted: encrypt(SECRET_NEEDLE) });

    const created = await paymentService.createDeposit(USER_ID, 2000);
    const deposit = await deposits.findById(created.depositId);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: deposit!.id,
      providerTransactionId: deposit!.providerTransactionId!,
      webhookSecret: SECRET_NEEDLE,
    });
    await paymentService.handleWebhook(credential.provider, built.rawBody, built.signatureHeader);

    const { items } = await logs.listAdmin({ page: 1, pageSize: 100 });
    expect(items.length).toBeGreaterThan(0);
    for (const row of items) {
      expect(JSON.stringify(row)).not.toContain(SECRET_NEEDLE);
    }
  });

  it("never logs a player's plaintext PIX key", async () => {
    const { paymentService, walletService, logs } = await buildPaymentTestHarness();
    await walletService.credit({
      userId: USER_ID,
      amountCents: 5000,
      type: "DEPOSIT",
      origin: "test-setup",
      idempotencyKey: "setup-credit-redaction",
      actor: { actorId: null, actorType: "SYSTEM" },
    });

    const plaintextPixKey = "player-real-pix-key@example.com";
    await paymentService.requestWithdraw(USER_ID, 1000, plaintextPixKey, "EMAIL", {
      actorId: USER_ID,
      actorType: "USER",
    });

    const { items } = await logs.listAdmin({ page: 1, pageSize: 100 });
    for (const row of items) {
      expect(JSON.stringify(row)).not.toContain(plaintextPixKey);
    }
  });
});
