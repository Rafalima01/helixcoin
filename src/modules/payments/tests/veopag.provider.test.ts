import { createHmac } from "node:crypto";
import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("@/modules/payments/providers/veopag/veopag-auth", () => ({
  VEOPAG_BASE_URL: "https://api.veopag.com",
  getVeoPagToken: vi.fn().mockResolvedValue("test-jwt-token"),
  invalidateVeoPagToken: vi.fn().mockResolvedValue(undefined),
}));

import { VeoPagProvider } from "@/modules/payments/providers/veopag/veopag.provider";

const WEBHOOK_SECRET = "test-veopag-webhook-secret";

function buildProvider() {
  return new VeoPagProvider({ credentialId: "cred-veopag", clientId: "cli_test", clientSecret: "secret_test" });
}

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

function lastRequestBody(): Record<string, unknown> {
  const mockFetch = fetch as unknown as { mock: { calls: unknown[][] } };
  const call = mockFetch.mock.calls.at(-1) as [string, RequestInit];
  return JSON.parse(call[1].body as string) as Record<string, unknown>;
}

describe("VeoPagProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("createPixDeposit converts amountCents to decimal reais and maps the 201 qrCodeResponse shape", async () => {
    stubFetchOnce(201, {
      message: "Deposit created successfully.",
      qrCodeResponse: { transactionId: "tx-1", status: "PENDING", qrcode: "00020126...", amount: 100.0, fee: 2.5 },
    });
    const provider = buildProvider();
    const result = await provider.createPixDeposit({
      depositId: "dep-1",
      amountCents: 10000,
      expiresAt: new Date(),
      payerName: "João Silva",
      payerEmail: "joao@example.com",
      payerDocument: "12345678901",
    });

    expect(result.providerTransactionId).toBe("tx-1");
    expect(result.pixCode).toBe("00020126...");

    const body = lastRequestBody();
    expect(body.amount).toBe(100);
    expect(body.payer).toEqual({ name: "João Silva", email: "joao@example.com", document: "12345678901" });
  });

  it("createPixDeposit handles the flat idempotent-replay (200) response shape", async () => {
    stubFetchOnce(200, {
      transaction_id: "tx-1",
      external_id: "dep-1",
      amount: 100,
      status: "PENDING",
      qrcode: "00020126...",
      idempotent: true,
    });
    const provider = buildProvider();
    const result = await provider.createPixDeposit({ depositId: "dep-1", amountCents: 10000, expiresAt: new Date() });
    expect(result.providerTransactionId).toBe("tx-1");
    expect(result.pixCode).toBe("00020126...");
  });

  it("createPixDeposit defaults missing payer fields to VeoPag's documented fallback values", async () => {
    stubFetchOnce(201, { qrCodeResponse: { transactionId: "tx-2", qrcode: "code", amount: 10, fee: 0 } });
    const provider = buildProvider();
    await provider.createPixDeposit({ depositId: "dep-2", amountCents: 1000, expiresAt: new Date() });
    const body = lastRequestBody();
    expect((body.payer as Record<string, string>).document).toBe("00000000000");
    expect((body.payer as Record<string, string>).email).toBe("noreply@pagamento.digital");
  });

  it("getDeposit maps COMPLETED to PAID and computes paidAmountCents", async () => {
    stubFetchOnce(200, { deposit: { transaction_id: "tx-1", status: "COMPLETED", amount: 55.5 } });
    const provider = buildProvider();
    const result = await provider.getDeposit({ providerTransactionId: "tx-1" });
    expect(result.status).toBe("PAID");
    expect(result.paidAmountCents).toBe(5550);
  });

  it("getDeposit maps FAILED and PROCESSING statuses correctly", async () => {
    const provider = buildProvider();
    stubFetchOnce(200, { deposit: { transaction_id: "t", status: "FAILED", amount: 10 } });
    expect((await provider.getDeposit({ providerTransactionId: "t" })).status).toBe("FAILED");
    stubFetchOnce(200, { deposit: { transaction_id: "t", status: "PROCESSING", amount: 10 } });
    expect((await provider.getDeposit({ providerTransactionId: "t" })).status).toBe("PROCESSING");
  });

  it("createWithdraw maps RANDOM to EVP and includes taxId when provided", async () => {
    stubFetchOnce(200, { withdrawal: { transaction_id: "wtx-1", status: "PENDING", amount: 50, fee: 2.5, total: 52.5 } });
    const provider = buildProvider();
    const result = await provider.createWithdraw({
      withdrawId: "w1",
      amountCents: 5000,
      pixKey: "abc-random-key",
      pixKeyType: "RANDOM",
      payeeDocument: "12345678901",
      payeeName: "João",
    });
    expect(result.providerTransactionId).toBe("wtx-1");
    const body = lastRequestBody();
    expect(body.key_type).toBe("EVP");
    expect(body.taxId).toBe("12345678901");
    expect(body.amount).toBe(50);
  });

  it("createWithdraw throws when a taxId-requiring key type has no payeeDocument", async () => {
    const provider = buildProvider();
    await expect(
      provider.createWithdraw({ withdrawId: "w1", amountCents: 5000, pixKey: "user@example.com", pixKeyType: "EMAIL" })
    ).rejects.toThrow(/CPF\/CNPJ/);
  });

  it("createWithdraw does not require payeeDocument for CPF/CNPJ key types", async () => {
    stubFetchOnce(200, { withdrawal: { transaction_id: "wtx-2", status: "PENDING", amount: 10, fee: 0, total: 10 } });
    const provider = buildProvider();
    const result = await provider.createWithdraw({ withdrawId: "w2", amountCents: 1000, pixKey: "12345678901", pixKeyType: "CPF" });
    expect(result.providerTransactionId).toBe("wtx-2");
  });

  it("createWithdraw throws when pixKeyType is missing (VeoPag requires key_type)", async () => {
    const provider = buildProvider();
    await expect(provider.createWithdraw({ withdrawId: "w3", amountCents: 1000, pixKey: "x" })).rejects.toThrow(/obrigatório/i);
  });

  it("getWithdraw maps COMPLETED to APPROVED and FAILED to FAILED", async () => {
    const provider = buildProvider();
    stubFetchOnce(200, { withdraw: { transaction_id: "t", status: "COMPLETED", amount: 10 } });
    expect((await provider.getWithdraw({ providerTransactionId: "t" })).status).toBe("APPROVED");
    stubFetchOnce(200, { withdraw: { transaction_id: "t", status: "FAILED", amount: 10 } });
    expect((await provider.getWithdraw({ providerTransactionId: "t" })).status).toBe("FAILED");
  });

  it("cancelDeposit/cancelWithdraw are safe no-ops — VeoPag has no cancel endpoint", async () => {
    const provider = buildProvider();
    expect((await provider.cancelDeposit({ providerTransactionId: "t" })).cancelled).toBe(false);
    expect((await provider.cancelWithdraw({ providerTransactionId: "t" })).cancelled).toBe(false);
  });

  // -------------------------------------------------------- validateWebhook

  it("validateWebhook accepts a correctly signed, fresh Deposit COMPLETED payload", async () => {
    const provider = buildProvider();
    const built = VeoPagProvider.buildReconciliationWebhook({
      relatedType: "DEPOSIT",
      providerTransactionId: "tx-1",
      externalId: "dep-1",
      status: "COMPLETED",
      amount: 100,
      webhookSecret: WEBHOOK_SECRET,
    });
    const result = await provider.validateWebhook({
      rawBody: built.rawBody,
      signatureHeader: built.signatureHeader,
      webhookSecret: WEBHOOK_SECRET,
      timestampHeader: built.timestampHeader,
    });
    expect(result.valid).toBe(true);
    expect(result.eventType).toBe("deposit.paid");
    expect(result.relatedType).toBe("DEPOSIT");
    expect(result.providerTransactionId).toBe("tx-1");
  });

  it("validateWebhook maps Withdrawal COMPLETED/FAILED to withdraw.approved/withdraw.rejected", async () => {
    const provider = buildProvider();
    const approved = VeoPagProvider.buildReconciliationWebhook({
      relatedType: "WITHDRAW",
      providerTransactionId: "w1",
      status: "COMPLETED",
      amount: 50,
      webhookSecret: WEBHOOK_SECRET,
    });
    const r1 = await provider.validateWebhook({
      rawBody: approved.rawBody,
      signatureHeader: approved.signatureHeader,
      webhookSecret: WEBHOOK_SECRET,
      timestampHeader: approved.timestampHeader,
    });
    expect(r1.eventType).toBe("withdraw.approved");

    const rejected = VeoPagProvider.buildReconciliationWebhook({
      relatedType: "WITHDRAW",
      providerTransactionId: "w2",
      status: "FAILED",
      amount: 50,
      webhookSecret: WEBHOOK_SECRET,
    });
    const r2 = await provider.validateWebhook({
      rawBody: rejected.rawBody,
      signatureHeader: rejected.signatureHeader,
      webhookSecret: WEBHOOK_SECRET,
      timestampHeader: rejected.timestampHeader,
    });
    expect(r2.eventType).toBe("withdraw.rejected");
  });

  it("validateWebhook rejects a tampered body even with the original signature", async () => {
    const provider = buildProvider();
    const built = VeoPagProvider.buildReconciliationWebhook({
      relatedType: "DEPOSIT",
      providerTransactionId: "tx-1",
      status: "COMPLETED",
      amount: 100,
      webhookSecret: WEBHOOK_SECRET,
    });
    const tampered = built.rawBody.replace("COMPLETED", "FAILED");
    const result = await provider.validateWebhook({
      rawBody: tampered,
      signatureHeader: built.signatureHeader,
      webhookSecret: WEBHOOK_SECRET,
      timestampHeader: built.timestampHeader,
    });
    expect(result.valid).toBe(false);
  });

  it("validateWebhook rejects a stale timestamp (replay protection)", async () => {
    const provider = buildProvider();
    const staleTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes old
    const payload = JSON.stringify({ type: "Deposit", transaction_id: "tx-1", status: "COMPLETED", amount: 100 });
    const signatureHeader = createHmac("sha256", WEBHOOK_SECRET).update(`${staleTimestamp}.${payload}`).digest("hex");
    const result = await provider.validateWebhook({
      rawBody: payload,
      signatureHeader,
      webhookSecret: WEBHOOK_SECRET,
      timestampHeader: staleTimestamp,
    });
    expect(result.valid).toBe(false);
  });

  it("validateWebhook does not synthesize a fake event for PENDING/PROCESSING deliveries", async () => {
    const provider = buildProvider();
    const timestampHeader = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({ type: "Deposit", transaction_id: "tx-1", status: "PENDING", amount: 100 });
    const signatureHeader = createHmac("sha256", WEBHOOK_SECRET).update(`${timestampHeader}.${payload}`).digest("hex");
    const result = await provider.validateWebhook({
      rawBody: payload,
      signatureHeader,
      webhookSecret: WEBHOOK_SECRET,
      timestampHeader,
    });
    expect(result.valid).toBe(false);
  });

  it("health() reports ONLINE on 200 and DEGRADED on a non-2xx response", async () => {
    const provider = buildProvider();
    stubFetchOnce(200, { balance: 100 });
    expect((await provider.health()).status).toBe("ONLINE");
    stubFetchOnce(500, { message: "error" });
    expect((await provider.health()).status).toBe("DEGRADED");
  });
});
