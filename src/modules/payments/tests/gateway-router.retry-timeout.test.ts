import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { eventBus } from "@/server/events";
import { encrypt } from "@/server/security/crypto-utils";
import { PAYMENT_EVENTS } from "@/modules/payments/events/payments.events";
import { buildPaymentTestHarness } from "@/modules/payments/tests/test-helpers";

const USER_ID = "user-retry-timeout-1";

/**
 * Fase 10 — `credential.maxRetries`/`timeoutMs` were stored-but-unread
 * columns before this phase; these tests prove PaymentService.withFailover
 * now actually honors them, using MockProvider's `simulatedErrorMode` lever
 * (deterministic failure/delay, no real network involved).
 */
describe("PaymentService.withFailover — retry, timeout, failover (Fase 10)", () => {
  it("retries the same candidate up to maxRetries times before giving up, publishing gatewayRetry each extra attempt", async () => {
    const { paymentService, credentials, credential } = await buildPaymentTestHarness();
    await credentials.update(credential.id, { maxRetries: 2, simulatedErrorMode: "ERROR_500" });

    const retryHandler = vi.fn();
    const unsubscribe = eventBus.subscribe(PAYMENT_EVENTS.gatewayRetry, retryHandler);
    try {
      await expect(paymentService.createDeposit(USER_ID, 1000)).rejects.toThrow();
      expect(retryHandler).toHaveBeenCalledTimes(2); // maxRetries=2 -> attempts 0,1,2 -> retry events at attempt 1 and 2
      expect(retryHandler.mock.calls[0][0].payload).toMatchObject({ gatewayCredentialId: credential.id, attempt: 1, maxRetries: 2 });
      expect(retryHandler.mock.calls[1][0].payload).toMatchObject({ gatewayCredentialId: credential.id, attempt: 2, maxRetries: 2 });
    } finally {
      unsubscribe();
    }
  });

  it("a call exceeding timeoutMs is aborted and reported as a timeout, not left hanging", async () => {
    const { paymentService, credentials, credential } = await buildPaymentTestHarness();
    // MockProvider's TIMEOUT fault delays MOCK_TIMEOUT_FAULT_DELAY_MS (250ms) — set timeoutMs well below that.
    await credentials.update(credential.id, { maxRetries: 0, timeoutMs: 20, simulatedErrorMode: "TIMEOUT" });

    const timeoutHandler = vi.fn();
    const unsubscribe = eventBus.subscribe(PAYMENT_EVENTS.gatewayTimeout, timeoutHandler);
    try {
      await expect(paymentService.createDeposit(USER_ID, 1000)).rejects.toThrow();
      expect(timeoutHandler).toHaveBeenCalledTimes(1);
      expect(timeoutHandler.mock.calls[0][0].payload).toMatchObject({ gatewayCredentialId: credential.id, attempt: 0, timeoutMs: 20 });
    } finally {
      unsubscribe();
    }
  });

  it("fails the primary candidate over to the next healthy one, publishing gatewayFailover, and still completes the deposit", async () => {
    const { paymentService, credentials, settingsRepo, credential } = await buildPaymentTestHarness();
    await credentials.update(credential.id, { maxRetries: 0, priority: 0, simulatedErrorMode: "OFFLINE_CALLS" });

    const backup = await credentials.create({
      name: "Mock backup",
      provider: "MOCK",
      active: true,
      priority: 1,
      credentialsEncrypted: encrypt("{}"),
      webhookSecretEncrypted: encrypt("backup-secret"),
    });
    await settingsRepo.update({ routingMode: "FAILOVER", defaultGatewayCredentialId: null });

    const failoverHandler = vi.fn();
    const unsubscribe = eventBus.subscribe(PAYMENT_EVENTS.gatewayFailover, failoverHandler);
    try {
      const created = await paymentService.createDeposit(USER_ID, 1000);
      expect(created.status).toBe("PENDING");

      expect(failoverHandler).toHaveBeenCalledTimes(1);
      expect(failoverHandler.mock.calls[0][0].payload).toMatchObject({
        fromGatewayCredentialId: credential.id,
        toGatewayCredentialId: backup.id,
      });
    } finally {
      unsubscribe();
    }
  });
});
