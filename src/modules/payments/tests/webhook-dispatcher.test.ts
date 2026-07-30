import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { eventBus } from "@/server/events";
import { encrypt } from "@/server/security/crypto-utils";
import { PAYMENT_EVENTS } from "@/modules/payments/events/payments.events";
import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";
import { WebhookDispatcherService } from "@/modules/payments/services/webhook-dispatcher.service";
import { InMemoryGatewayCredentialRepository } from "@/modules/payments/repositories/gateway-credential.in-memory-repository";
import { InMemoryPaymentWebhookRepository } from "@/modules/payments/repositories/payment-webhook.in-memory-repository";
import { InMemoryGatewayLogRepository } from "@/modules/payments/repositories/gateway-log.in-memory-repository";

const WEBHOOK_SECRET = "dispatcher-test-secret";
const DEPOSIT_ID = "dep-dispatcher-1";

/**
 * Unit-level coverage of the generic mechanics WebhookDispatcherService owns
 * (Fase 10 extraction) — signature matching, idempotency, and delegating to
 * an injected `settle` — independent of PaymentService's wallet business
 * logic, which is stubbed here via a plain vi.fn().
 */
async function buildDispatcherHarness(settle: (webhook: unknown) => Promise<void> = vi.fn()) {
  const credentials = new InMemoryGatewayCredentialRepository();
  const webhooks = new InMemoryPaymentWebhookRepository();
  const logs = new InMemoryGatewayLogRepository();

  const credential = await credentials.create({
    name: "Mock",
    provider: "MOCK",
    active: true,
    credentialsEncrypted: encrypt("{}"),
    webhookSecretEncrypted: encrypt(WEBHOOK_SECRET),
  });

  const resolveRelatedId = vi.fn().mockResolvedValue(DEPOSIT_ID);
  const dispatcher = new WebhookDispatcherService(webhooks, credentials, logs, resolveRelatedId, settle as never);
  return { dispatcher, webhooks, credentials, logs, credential, resolveRelatedId };
}

describe("WebhookDispatcherService", () => {
  it("dispatches a validly-signed delivery to the injected settle callback", async () => {
    const settle = vi.fn().mockResolvedValue(undefined);
    const { dispatcher, credential } = await buildDispatcherHarness(settle);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: DEPOSIT_ID,
      providerTransactionId: `mock_dep_${DEPOSIT_ID}`,
      webhookSecret: WEBHOOK_SECRET,
    });

    const result = await dispatcher.dispatch(credential.provider, built.rawBody, built.signatureHeader);
    expect(result.status).toBe(200);
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle.mock.calls[0][0]).toMatchObject({ eventType: "deposit.paid", relatedId: DEPOSIT_ID });
  });

  it("throws Unauthorized when no registered credential validates the signature", async () => {
    const { dispatcher, credential } = await buildDispatcherHarness();

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: DEPOSIT_ID,
      providerTransactionId: `mock_dep_${DEPOSIT_ID}`,
      webhookSecret: "wrong-secret",
    });

    await expect(dispatcher.dispatch(credential.provider, built.rawBody, built.signatureHeader)).rejects.toThrow();
  });

  it("a duplicate delivery (same providerEventId) does not call settle again and publishes webhookDuplicate", async () => {
    const settle = vi.fn().mockResolvedValue(undefined);
    const { dispatcher, credential } = await buildDispatcherHarness(settle);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: DEPOSIT_ID,
      providerTransactionId: `mock_dep_${DEPOSIT_ID}`,
      webhookSecret: WEBHOOK_SECRET,
    });

    const duplicateHandler = vi.fn();
    const unsubscribe = eventBus.subscribe(PAYMENT_EVENTS.webhookDuplicate, duplicateHandler);
    try {
      await dispatcher.dispatch(credential.provider, built.rawBody, built.signatureHeader);
      const second = await dispatcher.dispatch(credential.provider, built.rawBody, built.signatureHeader);

      expect(second.status).toBe(200);
      expect(settle).toHaveBeenCalledTimes(1); // NOT called again for the replay
      expect(duplicateHandler).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it("when settle throws, the webhook is recorded ERROR and the dispatcher returns status 500", async () => {
    const settle = vi.fn().mockRejectedValue(new Error("boom"));
    const { dispatcher, webhooks, credential } = await buildDispatcherHarness(settle);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: DEPOSIT_ID,
      providerTransactionId: `mock_dep_${DEPOSIT_ID}`,
      webhookSecret: WEBHOOK_SECRET,
    });

    const result = await dispatcher.dispatch(credential.provider, built.rawBody, built.signatureHeader);
    expect(result.status).toBe(500);

    const { items } = await webhooks.listAdmin({ page: 1, pageSize: 10 });
    expect(items[0].status).toBe("ERROR");
    expect(items[0].errorMessage).toBe("boom");
  });

  it("reprocess() re-runs settle for an already-stored webhook without needing a fresh signature", async () => {
    const settle = vi.fn().mockResolvedValue(undefined);
    const { dispatcher, webhooks, credential } = await buildDispatcherHarness(settle);

    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: DEPOSIT_ID,
      providerTransactionId: `mock_dep_${DEPOSIT_ID}`,
      webhookSecret: WEBHOOK_SECRET,
    });
    await dispatcher.dispatch(credential.provider, built.rawBody, built.signatureHeader);

    const { items } = await webhooks.listAdmin({ page: 1, pageSize: 10 });
    const result = await dispatcher.reprocess(items[0].id);

    expect(result.status).toBe(200);
    expect(settle).toHaveBeenCalledTimes(2);
    const updated = await webhooks.findById(items[0].id);
    expect(updated?.status).toBe("REPROCESSED");
    expect(updated?.reprocessCount).toBe(1);
  });
});
