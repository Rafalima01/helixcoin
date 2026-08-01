import { describe, expect, it, vi, afterEach } from "vitest";
import { AmploPayProvider } from "@/modules/payments/providers/amplopay/amplopay.provider";

const WEBHOOK_SECRET = "test-amplopay-webhook-secret";

function buildProvider() {
  return new AmploPayProvider({ publicKey: "pub_test", secretKey: "sec_test" });
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

function lastRequestHeaders(): Record<string, string> {
  const mockFetch = fetch as unknown as { mock: { calls: unknown[][] } };
  const call = mockFetch.mock.calls.at(-1) as [string, RequestInit];
  return call[1].headers as Record<string, string>;
}

describe("AmploPayProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // --------------------------------------------------------- createPixDeposit

  it("createPixDeposit sends x-public-key/x-secret-key headers and converts amountCents to decimal reais", async () => {
    stubFetchOnce(201, {
      status: "OK",
      transactionId: "tx-1",
      pix: { code: "00020126...", image: "https://amplopay.example/qr/tx-1", base64: "" },
    });
    const provider = buildProvider();
    const result = await provider.createPixDeposit({
      depositId: "dep-1",
      amountCents: 10050,
      expiresAt: new Date("2026-01-01T00:00:00Z"),
      payerName: "João Silva",
      payerEmail: "joao@example.com",
      payerPhone: "(11) 98888-7777",
      payerDocument: "12345678901",
    });

    expect(result.providerTransactionId).toBe("tx-1");
    expect(result.pixCode).toBe("00020126...");
    expect(result.qrCodeUrl).toBe("https://amplopay.example/qr/tx-1");

    const headers = lastRequestHeaders();
    expect(headers["x-public-key"]).toBe("pub_test");
    expect(headers["x-secret-key"]).toBe("sec_test");

    const body = lastRequestBody();
    expect(body.amount).toBe(100.5);
    expect(body.identifier).toBe("dep-1");
    expect(body.client).toEqual({
      name: "João Silva",
      email: "joao@example.com",
      phone: "(11) 98888-7777",
      document: "12345678901",
    });
    expect(body.callbackUrl).toMatch(/\/api\/payments\/webhook\/AMPLOPAY$/);
  });

  it("createPixDeposit throws when payerDocument is missing (no safe fallback for CPF/CNPJ)", async () => {
    const provider = buildProvider();
    await expect(
      provider.createPixDeposit({ depositId: "dep-2", amountCents: 1000, expiresAt: new Date() })
    ).rejects.toThrow(/CPF\/CNPJ/);
  });

  it("createPixDeposit defaults missing name/email/phone to safe placeholders", async () => {
    stubFetchOnce(201, { status: "OK", transactionId: "tx-2", pix: { code: "code", image: "" } });
    const provider = buildProvider();
    await provider.createPixDeposit({ depositId: "dep-3", amountCents: 1000, expiresAt: new Date(), payerDocument: "12345678901" });
    const body = lastRequestBody();
    const client = body.client as Record<string, string>;
    expect(client.name).toBe("Cliente HeliJump");
    expect(client.email).toBe("noreply@pagamento.digital");
    expect(client.phone).toBe("(11) 99999-9999");
  });

  it("createPixDeposit throws when the API reports a non-OK status even on a 2xx response", async () => {
    stubFetchOnce(201, { status: "FAILED", message: "Documento inválido" });
    const provider = buildProvider();
    await expect(
      provider.createPixDeposit({ depositId: "dep-4", amountCents: 1000, expiresAt: new Date(), payerDocument: "12345678901" })
    ).rejects.toThrow(/Documento inválido/);
  });

  // ----------------------------------------------------------------- getDeposit

  it("getDeposit maps COMPLETED to PAID and computes paidAmountCents", async () => {
    stubFetchOnce(200, { id: "tx-1", status: "COMPLETED", amount: 55.5 });
    const provider = buildProvider();
    const result = await provider.getDeposit({ providerTransactionId: "tx-1" });
    expect(result.status).toBe("PAID");
    expect(result.paidAmountCents).toBe(5550);
  });

  it("getDeposit maps FAILED, REFUNDED and CHARGED_BACK correctly", async () => {
    const provider = buildProvider();
    stubFetchOnce(200, { id: "t", status: "FAILED", amount: 10 });
    expect((await provider.getDeposit({ providerTransactionId: "t" })).status).toBe("FAILED");
    stubFetchOnce(200, { id: "t", status: "REFUNDED", amount: 10 });
    expect((await provider.getDeposit({ providerTransactionId: "t" })).status).toBe("REFUNDED");
    stubFetchOnce(200, { id: "t", status: "CHARGED_BACK", amount: 10 });
    expect((await provider.getDeposit({ providerTransactionId: "t" })).status).toBe("FAILED");
  });

  it("getDeposit defaults an unrecognized status to PENDING", async () => {
    stubFetchOnce(200, { id: "t", status: "PENDING", amount: 10 });
    const provider = buildProvider();
    expect((await provider.getDeposit({ providerTransactionId: "t" })).status).toBe("PENDING");
  });

  // -------------------------------------------------------------- createWithdraw

  it("createWithdraw sends lowercase pix.type + owner.document derived from payeeDocument length", async () => {
    stubFetchOnce(200, { webhookToken: "whtok", withdraw: { id: "wtx-1", status: "PENDING" } });
    const provider = buildProvider();
    const result = await provider.createWithdraw({
      withdrawId: "w1",
      amountCents: 5000,
      pixKey: "joao@example.com",
      pixKeyType: "EMAIL",
      payeeName: "João",
      payeeDocument: "12345678901",
      payerIp: "203.0.113.10",
    });
    expect(result.providerTransactionId).toBe("wtx-1");
    expect(result.status).toBe("PENDING");

    const body = lastRequestBody();
    expect(body.pix).toEqual({ type: "email", key: "joao@example.com" });
    expect(body.owner).toEqual({ ip: "203.0.113.10", name: "João", document: { type: "cpf", number: "12345678901" } });
  });

  it("createWithdraw derives cnpj for a 14-digit document", async () => {
    stubFetchOnce(200, { withdraw: { id: "wtx-2", status: "PENDING" } });
    const provider = buildProvider();
    await provider.createWithdraw({
      withdrawId: "w2",
      amountCents: 5000,
      pixKey: "12345678000199",
      pixKeyType: "CNPJ",
      payeeDocument: "12345678000199",
      payerIp: "203.0.113.10",
    });
    const body = lastRequestBody();
    expect((body.owner as { document: { type: string } }).document.type).toBe("cnpj");
  });

  it("createWithdraw throws when payerIp is missing (AmploPay antifraud requires it)", async () => {
    const provider = buildProvider();
    await expect(
      provider.createWithdraw({ withdrawId: "w3", amountCents: 1000, pixKey: "x", pixKeyType: "CPF", payeeDocument: "12345678901" })
    ).rejects.toThrow(/IP do solicitante/);
  });

  it("createWithdraw throws when payeeDocument is missing", async () => {
    const provider = buildProvider();
    await expect(
      provider.createWithdraw({ withdrawId: "w4", amountCents: 1000, pixKey: "x", pixKeyType: "CPF", payerIp: "203.0.113.10" })
    ).rejects.toThrow(/CPF\/CNPJ/);
  });

  it("createWithdraw throws when pixKeyType is missing or unrecognized", async () => {
    const provider = buildProvider();
    await expect(
      provider.createWithdraw({ withdrawId: "w5", amountCents: 1000, pixKey: "x", payeeDocument: "12345678901", payerIp: "203.0.113.10" })
    ).rejects.toThrow(/obrigatório/i);
  });

  // ---------------------------------------------------------------- getWithdraw

  it("getWithdraw reads a flat status field and maps COMPLETED/FAILED", async () => {
    const provider = buildProvider();
    stubFetchOnce(200, { id: "wtx-1", status: "COMPLETED" });
    expect((await provider.getWithdraw({ providerTransactionId: "wtx-1" })).status).toBe("APPROVED");
    stubFetchOnce(200, { id: "wtx-1", status: "FAILED" });
    expect((await provider.getWithdraw({ providerTransactionId: "wtx-1" })).status).toBe("FAILED");
  });

  // --------------------------------------------------- cancelDeposit/cancelWithdraw

  it("cancelDeposit/cancelWithdraw are safe no-ops — AmploPay has no cancel endpoint", async () => {
    const provider = buildProvider();
    expect((await provider.cancelDeposit({ providerTransactionId: "t" })).cancelled).toBe(false);
    expect((await provider.cancelWithdraw({ providerTransactionId: "t" })).cancelled).toBe(false);
  });

  // -------------------------------------------------------------- validateWebhook

  it("validateWebhook accepts a TRANSACTION_PAID payload with a matching token", async () => {
    const provider = buildProvider();
    const payload = JSON.stringify({
      event: "TRANSACTION_PAID",
      token: WEBHOOK_SECRET,
      transaction: { id: "tx-1", status: "COMPLETED" },
    });
    const result = await provider.validateWebhook({ rawBody: payload, signatureHeader: null, webhookSecret: WEBHOOK_SECRET });
    expect(result.valid).toBe(true);
    expect(result.eventType).toBe("deposit.paid");
    expect(result.relatedType).toBe("DEPOSIT");
    expect(result.providerTransactionId).toBe("tx-1");
  });

  it("validateWebhook maps TRANSFER_COMPLETED/TRANSFER_FAILED to withdraw.approved/withdraw.rejected", async () => {
    const provider = buildProvider();
    const approved = JSON.stringify({ event: "TRANSFER_COMPLETED", token: WEBHOOK_SECRET, withdraw: { id: "w1" } });
    const r1 = await provider.validateWebhook({ rawBody: approved, signatureHeader: null, webhookSecret: WEBHOOK_SECRET });
    expect(r1.valid).toBe(true);
    expect(r1.eventType).toBe("withdraw.approved");
    expect(r1.relatedType).toBe("WITHDRAW");
    expect(r1.providerTransactionId).toBe("w1");

    const rejected = JSON.stringify({ event: "TRANSFER_FAILED", token: WEBHOOK_SECRET, withdraw: { id: "w2" } });
    const r2 = await provider.validateWebhook({ rawBody: rejected, signatureHeader: null, webhookSecret: WEBHOOK_SECRET });
    expect(r2.eventType).toBe("withdraw.rejected");
  });

  it("validateWebhook rejects a wrong token", async () => {
    const provider = buildProvider();
    const payload = JSON.stringify({ event: "TRANSACTION_PAID", token: "wrong-token", transaction: { id: "tx-1" } });
    const result = await provider.validateWebhook({ rawBody: payload, signatureHeader: null, webhookSecret: WEBHOOK_SECRET });
    expect(result.valid).toBe(false);
  });

  it("validateWebhook rejects a missing token", async () => {
    const provider = buildProvider();
    const payload = JSON.stringify({ event: "TRANSACTION_PAID", transaction: { id: "tx-1" } });
    const result = await provider.validateWebhook({ rawBody: payload, signatureHeader: null, webhookSecret: WEBHOOK_SECRET });
    expect(result.valid).toBe(false);
  });

  it("validateWebhook does not synthesize an event for TRANSACTION_CREATED/TRANSFER_CREATED (not yet terminal)", async () => {
    const provider = buildProvider();
    const payload = JSON.stringify({ event: "TRANSACTION_CREATED", token: WEBHOOK_SECRET, transaction: { id: "tx-1" } });
    const result = await provider.validateWebhook({ rawBody: payload, signatureHeader: null, webhookSecret: WEBHOOK_SECRET });
    expect(result.valid).toBe(false);
  });

  it("validateWebhook does not synthesize an event for TRANSACTION_CHARGED_BACK (unmodeled deposit-side chargeback)", async () => {
    const provider = buildProvider();
    const payload = JSON.stringify({ event: "TRANSACTION_CHARGED_BACK", token: WEBHOOK_SECRET, transaction: { id: "tx-1" } });
    const result = await provider.validateWebhook({ rawBody: payload, signatureHeader: null, webhookSecret: WEBHOOK_SECRET });
    expect(result.valid).toBe(false);
  });

  it("validateWebhook rejects malformed JSON", async () => {
    const provider = buildProvider();
    const result = await provider.validateWebhook({ rawBody: "not json", signatureHeader: null, webhookSecret: WEBHOOK_SECRET });
    expect(result.valid).toBe(false);
  });

  // ------------------------------------------------------------------------ health

  it("health() reports ONLINE on 200 and DEGRADED on a non-2xx response", async () => {
    const provider = buildProvider();
    stubFetchOnce(200, { available: 100, pending: 0, fundLock: 0 });
    expect((await provider.health()).status).toBe("ONLINE");
    stubFetchOnce(500, { message: "error" });
    expect((await provider.health()).status).toBe("DEGRADED");
  });
});
