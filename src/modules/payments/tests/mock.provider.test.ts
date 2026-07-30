import { describe, expect, it } from "vitest";
import { MockProvider } from "@/modules/payments/providers/mock/mock.provider";

const WEBHOOK_SECRET = "test-webhook-secret-mock";

describe("MockProvider", () => {
  it("createPixDeposit returns a well-formed, deterministic pixCode and providerTransactionId", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null });
    const expiresAt = new Date(Date.now() + 30 * 60_000);

    const first = await provider.createPixDeposit({ depositId: "dep-1", amountCents: 1000, expiresAt });
    const second = await provider.createPixDeposit({ depositId: "dep-1", amountCents: 1000, expiresAt });

    expect(first.providerTransactionId).toBe("mock_dep_dep-1");
    expect(first.pixCode).toBe(second.pixCode);
    expect(first.pixCode.startsWith("00020126580014BR.GOV.BCB.PIX")).toBe(true);
    expect(first.pixCode.length).toBeGreaterThan(40);
  });

  it("createWithdraw returns a deterministic providerTransactionId", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null });
    const result = await provider.createWithdraw({ withdrawId: "wd-1", amountCents: 500, pixKey: "user@example.com" });
    expect(result.providerTransactionId).toBe("mock_wd_wd-1");
    expect(result.status).toBe("PENDING");
  });

  it("validateWebhook accepts a correctly signed payload built by buildWebhookPayload", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null });
    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: "dep-1",
      providerTransactionId: "mock_dep_dep-1",
      webhookSecret: WEBHOOK_SECRET,
    });

    const result = await provider.validateWebhook({
      rawBody: built.rawBody,
      signatureHeader: built.signatureHeader,
      webhookSecret: WEBHOOK_SECRET,
    });

    expect(result.valid).toBe(true);
    expect(result.eventType).toBe("deposit.paid");
    expect(result.relatedType).toBe("DEPOSIT");
    expect(result.providerTransactionId).toBe("mock_dep_dep-1");
    expect(result.providerEventId).toBe(built.providerEventId);
  });

  it("validateWebhook rejects a tampered body even with the original signature", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null });
    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: "dep-1",
      providerTransactionId: "mock_dep_dep-1",
      webhookSecret: WEBHOOK_SECRET,
    });

    const tamperedBody = built.rawBody.replace("deposit.paid", "deposit.failed");
    const result = await provider.validateWebhook({
      rawBody: tamperedBody,
      signatureHeader: built.signatureHeader,
      webhookSecret: WEBHOOK_SECRET,
    });

    expect(result.valid).toBe(false);
  });

  it("validateWebhook rejects a signature computed with the wrong secret", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null });
    const built = MockProvider.buildWebhookPayload({
      eventType: "deposit.paid",
      relatedType: "DEPOSIT",
      relatedId: "dep-1",
      providerTransactionId: "mock_dep_dep-1",
      webhookSecret: "a-completely-different-secret",
    });

    const result = await provider.validateWebhook({
      rawBody: built.rawBody,
      signatureHeader: built.signatureHeader,
      webhookSecret: WEBHOOK_SECRET,
    });

    expect(result.valid).toBe(false);
  });

  it("validateWebhook rejects a missing signature header", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null });
    const result = await provider.validateWebhook({
      rawBody: '{"eventType":"deposit.paid"}',
      signatureHeader: null,
      webhookSecret: WEBHOOK_SECRET,
    });
    expect(result.valid).toBe(false);
  });

  it("health() echoes simulatedHealth when set, defaults to ONLINE otherwise", async () => {
    const online = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null });
    expect((await online.health()).status).toBe("ONLINE");

    const offline = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: "OFFLINE" });
    expect((await offline.health()).status).toBe("OFFLINE");

    const degraded = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: "DEGRADED" });
    expect((await degraded.health()).status).toBe("DEGRADED");
  });

  it("cancelWithdraw returns a deterministic success result", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null });
    const result = await provider.cancelWithdraw({ providerTransactionId: "mock_wd_wd-1" });
    expect(result.cancelled).toBe(true);
  });

  // -------------------------------------------------------- simulatedErrorMode (Fase 10)

  it("simulatedErrorMode=OFFLINE_CALLS makes every outbound call throw, but does not affect health()", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null, simulatedErrorMode: "OFFLINE_CALLS" });
    await expect(provider.createPixDeposit({ depositId: "d", amountCents: 100, expiresAt: new Date() })).rejects.toThrow();
    await expect(provider.createWithdraw({ withdrawId: "w", amountCents: 100, pixKey: "x@x.com" })).rejects.toThrow();
    expect((await provider.health()).status).toBe("ONLINE"); // simulatedHealth, not simulatedErrorMode, drives health()
  });

  it("simulatedErrorMode=ERROR_500 makes outbound calls throw an ExternalServiceError-shaped error", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null, simulatedErrorMode: "ERROR_500" });
    await expect(provider.getDeposit({ providerTransactionId: "mock_dep_d" })).rejects.toThrow(/erro interno/i);
  });

  it("simulatedErrorMode=AUTH_ERROR makes outbound calls throw an authentication-shaped error", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null, simulatedErrorMode: "AUTH_ERROR" });
    await expect(provider.createWithdraw({ withdrawId: "w", amountCents: 100, pixKey: "x@x.com" })).rejects.toThrow(/autenticação/i);
  });

  it("simulatedErrorMode=TIMEOUT delays the call instead of throwing — the caller (PaymentService.withTimeout) is what turns this into a timeout", async () => {
    const provider = new MockProvider({ webhookSecret: WEBHOOK_SECRET, simulatedHealth: null, simulatedErrorMode: "TIMEOUT" });
    const start = Date.now();
    const result = await provider.createWithdraw({ withdrawId: "w", amountCents: 100, pixKey: "x@x.com" });
    expect(Date.now() - start).toBeGreaterThanOrEqual(200);
    expect(result.providerTransactionId).toBe("mock_wd_w");
  });
});
