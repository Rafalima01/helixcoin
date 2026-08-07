import { timingSafeEqual } from "node:crypto";
import { BusinessRuleError, ExternalServiceError } from "@/server/errors";
import { PLAYER_URL } from "@/config/domains";
import type {
  PaymentProvider,
  CreatePixDepositInput,
  CreatePixDepositResult,
  GetDepositResult,
  CancelDepositResult,
  CreateWithdrawInput,
  CreateWithdrawResult,
  GetWithdrawResult,
  CancelWithdrawResult,
  ValidateWebhookInput,
  ValidateWebhookResult,
  ProviderHealthResult,
} from "@/modules/payments/interfaces/payment-provider.interface";
import type { DepositStatus, WithdrawStatus, PaymentRelatedType } from "@/modules/payments/entities/payments.entity";

export const AMPLOPAY_BASE_URL = "https://app.amplopay.com/api/v1";

/**
 * The one fixed callbackUrl every AmploPay charge/transfer is created with —
 * their API caps an integration at 20 registered webhooks and explicitly
 * documents (docs/faq/webhook-limit) that a *different* callbackUrl per
 * transaction is the #1 way integrators hit that cap. `identifier` (which we
 * already send as depositId/withdrawId) is what AmploPay echoes back in the
 * webhook body to correlate it to our record — never the URL itself.
 */
export const AMPLOPAY_WEBHOOK_CALLBACK_URL = `${PLAYER_URL}/api/payments/webhook/AMPLOPAY`;

type AmploPayPixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

/** AmploPay amounts are decimal BRL (e.g. `100.50`), never cents — same conversion boundary as VeoPag's provider. */
function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

function mapPixKeyType(pixKeyType: string | undefined): AmploPayPixKeyType {
  switch (pixKeyType) {
    case "CPF":
      return "cpf";
    case "CNPJ":
      return "cnpj";
    case "PHONE":
      return "phone";
    case "EMAIL":
      return "email";
    case "RANDOM":
      return "random";
    default:
      throw new BusinessRuleError("Tipo de chave PIX é obrigatório para saques via AmploPay");
  }
}

/** CPF has 11 digits, CNPJ has 14 — AmploPay's owner.document wants the type spelled out separately from the number, which our own domain (a single payeeDocument string) doesn't track. Length after stripping formatting is the standard, unambiguous way to tell them apart. */
function documentTypeFor(document: string): "cpf" | "cnpj" {
  const digits = document.replace(/\D/g, "");
  return digits.length > 11 ? "cnpj" : "cpf";
}

/** AmploPay's general "Status de transação" enum (docs/enums) — used by both the GET /transactions read and (per our own reading of the API) the transfer read/create flows. */
function mapDepositStatus(status: string): DepositStatus {
  switch (status) {
    case "COMPLETED":
      return "PAID";
    case "FAILED":
      return "FAILED";
    case "REFUNDED":
      return "REFUNDED";
    // CHARGED_BACK has no dedicated DepositStatus — treated as a terminal
    // failure for our ledger; the raw payload (logged) still carries the
    // real AmploPay status for a human to review.
    case "CHARGED_BACK":
      return "FAILED";
    default:
      return "PENDING";
  }
}

function mapWithdrawStatus(status: string | undefined): WithdrawStatus {
  switch (status) {
    case "COMPLETED":
      return "APPROVED";
    case "FAILED":
    case "REFUNDED":
    case "CHARGED_BACK":
      return "FAILED";
    default:
      return "PENDING";
  }
}

/**
 * deposit.paid/deposit.cancelled/deposit.refunded/withdraw.approved/
 * withdraw.rejected are the only events PaymentService.settle() knows how to
 * act on. TRANSACTION_CREATED/TRANSFER_CREATED (not yet a terminal outcome)
 * and TRANSACTION_CHARGED_BACK (no modeled deposit-side chargeback flow —
 * PIX has no real chargeback path the way cards do) intentionally return
 * "not actionable" rather than being forced into a fake event, mirroring
 * VeoPag's own mapWebhookEventType.
 */
function mapWebhookEventType(event: string): string | null {
  switch (event) {
    case "TRANSACTION_PAID":
      return "deposit.paid";
    case "TRANSACTION_CANCELED":
      return "deposit.cancelled";
    case "TRANSACTION_REFUNDED":
      return "deposit.refunded";
    case "TRANSFER_COMPLETED":
      return "withdraw.approved";
    case "TRANSFER_FAILED":
      return "withdraw.rejected";
    default:
      return null;
  }
}

interface AmploPayWebhookPayload {
  event: string;
  token?: string;
  transaction?: { id?: string; [key: string]: unknown };
  withdraw?: { id?: string; transactionId?: string; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Talks to the real AmploPay REST API (`https://app.amplopay.com/api/v1`).
 * Auth is two static headers (`x-public-key`/`x-secret-key`) — no
 * login/token exchange, so unlike VeoPag this needs no auth module or Redis
 * cache. See docs/design/... (session notes) for the full endpoint map this
 * was built against; the two gaps flagged inline below (exact field path for
 * a transfer's id/status, and the "Buscar transferência" GET shape) were not
 * directly confirmed in AmploPay's docs and should be verified against a
 * real sandbox call before enabling AMPLOPAY withdrawals in production.
 */
export class AmploPayProvider implements PaymentProvider {
  readonly name = "AMPLOPAY" as const;

  constructor(
    private readonly params: {
      publicKey: string;
      secretKey: string;
    }
  ) {}

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${AMPLOPAY_BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
        "x-public-key": this.params.publicKey,
        "x-secret-key": this.params.secretKey,
      },
    });
  }

  private async readJson(res: Response): Promise<Record<string, unknown> | null> {
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** Attaches the raw HTTP status + response body as the error's `details` — surfaced as `GatewayLog.responseSummary` in the admin "Logs de Gateway" screen (see PaymentService.withFailover), so a rejection AmploPay explains only in the body (not `message`) is still visible instead of collapsing into a generic "(HTTP 200)" string. */
  private fail(message: string, res: Response, json: Record<string, unknown> | null): never {
    throw new ExternalServiceError("AMPLOPAY", message, { httpStatus: res.status, response: json });
  }

  async createPixDeposit(input: CreatePixDepositInput): Promise<CreatePixDepositResult> {
    if (!input.payerDocument) {
      throw new BusinessRuleError("CPF/CNPJ do pagador é obrigatório para depósito via AmploPay");
    }

    const body = {
      identifier: input.depositId,
      amount: centsToAmount(input.amountCents),
      client: {
        name: input.payerName || "Cliente HeliJump",
        email: input.payerEmail || "noreply@pagamento.digital",
        phone: input.payerPhone || "(11) 99999-9999",
        document: input.payerDocument,
      },
      callbackUrl: AMPLOPAY_WEBHOOK_CALLBACK_URL,
    };

    const res = await this.call("/gateway/pix/receive", { method: "POST", body: JSON.stringify(body) });
    const json = await this.readJson(res);
    const status = json?.status as string | undefined;
    // "PENDING" is the normal, expected status for a just-created charge
    // (it only becomes "COMPLETED" once the payer actually pays — see
    // mapDepositStatus for the query-side vocabulary) — only FAILED/
    // REJECTED/CANCELED are real creation failures. A real production
    // response confirmed this: status="PENDING" with a fully valid
    // transactionId/pix.code, which an earlier "must equal OK" check here
    // was incorrectly rejecting as a failure.
    if (!res.ok || status === "FAILED" || status === "REJECTED" || status === "CANCELED") {
      this.fail(
        (json?.message as string) ?? `Falha ao criar cobrança PIX: status="${status ?? "desconhecido"}" (HTTP ${res.status})`,
        res,
        json
      );
    }

    const providerTransactionId = json?.transactionId as string | undefined;
    const pix = json?.pix as Record<string, unknown> | undefined;
    const pixCode = pix?.code as string | undefined;
    if (!providerTransactionId || !pixCode) {
      this.fail("Resposta de criação de cobrança sem transactionId/pix.code", res, json);
    }

    // Field is `pix.base64` (a raw base64 PNG payload), not `pix.image` —
    // confirmed against a real response. The app's own PixQr component
    // renders the QR client-side from `pixCode` regardless, so this is
    // only ever a fallback image source.
    const base64 = pix?.base64 as string | undefined;

    return {
      providerTransactionId,
      pixCode,
      qrCodeUrl: base64 ? `data:image/png;base64,${base64}` : undefined,
      expiresAt: input.expiresAt,
      raw: json ?? undefined,
    };
  }

  async getDeposit(input: { providerTransactionId: string }): Promise<GetDepositResult> {
    const res = await this.call(`/gateway/transactions?id=${encodeURIComponent(input.providerTransactionId)}`);
    const json = await this.readJson(res);
    if (!res.ok) {
      this.fail((json?.message as string) ?? `Falha ao consultar transação (HTTP ${res.status})`, res, json);
    }
    const status = json?.status as string | undefined;
    if (!status) this.fail("Transação não encontrada na AmploPay", res, json);

    return {
      providerTransactionId: (json?.id as string) ?? input.providerTransactionId,
      status: mapDepositStatus(status),
      paidAmountCents: status === "COMPLETED" && typeof json?.amount === "number" ? amountToCents(json.amount) : undefined,
      raw: json ?? undefined,
    };
  }

  /** AmploPay has no cancel-charge endpoint documented — PIX QR codes just expire on their own, same as VeoPag. Never actually invoked by PaymentService today (see the interface's own doc comment). */
  async cancelDeposit(input: { providerTransactionId: string }): Promise<CancelDepositResult> {
    return { cancelled: false, raw: { unsupported: true, providerTransactionId: input.providerTransactionId } };
  }

  async createWithdraw(input: CreateWithdrawInput): Promise<CreateWithdrawResult> {
    if (!input.payerIp) {
      throw new BusinessRuleError(
        "IP do solicitante é obrigatório para saque via AmploPay (antifraude — deve ser diferente do IP da aplicação)"
      );
    }
    if (!input.payeeDocument) {
      throw new BusinessRuleError("CPF/CNPJ do titular é obrigatório para saque via AmploPay");
    }

    const body = {
      identifier: input.withdrawId,
      amount: centsToAmount(input.amountCents),
      pix: { type: mapPixKeyType(input.pixKeyType), key: input.pixKey },
      owner: {
        ip: input.payerIp,
        name: input.payeeName || "Titular da conta",
        document: { type: documentTypeFor(input.payeeDocument), number: input.payeeDocument },
      },
      callbackUrl: AMPLOPAY_WEBHOOK_CALLBACK_URL,
    };

    const res = await this.call("/gateway/transfers", { method: "POST", body: JSON.stringify(body) });
    const json = await this.readJson(res);
    if (!res.ok) {
      this.fail((json?.message as string) ?? `Falha ao solicitar transferência (HTTP ${res.status})`, res, json);
    }

    // The docs never fully expanded `withdraw`'s own fields, only its
    // presence — tried in the order most other AmploPay resources use
    // (nested id, nested transactionId, then a flat fallback) so a real
    // response still resolves even if the exact nesting differs slightly
    // from this guess. See this file's class doc comment.
    const w = (json?.withdraw as Record<string, unknown> | undefined) ?? {};
    const providerTransactionId = (w.id ?? w.transactionId ?? json?.id ?? json?.transactionId) as string | undefined;
    if (!providerTransactionId) {
      this.fail("Resposta de transferência sem id da transação", res, json);
    }

    return { providerTransactionId, status: mapWithdrawStatus(w.status as string | undefined), raw: json ?? undefined };
  }

  /**
   * `GET /gateway/transfers?id=` — inferred from the exact "create at the
   * plural resource, read at the same plural resource with ?id=" pattern
   * every other AmploPay resource pair in these docs follows (transactions
   * mirrors this for deposits); not directly confirmed against a live
   * response. Verify in sandbox before relying on this for real withdrawal
   * reconciliation.
   */
  async getWithdraw(input: { providerTransactionId: string }): Promise<GetWithdrawResult> {
    const res = await this.call(`/gateway/transfers?id=${encodeURIComponent(input.providerTransactionId)}`);
    const json = await this.readJson(res);
    if (!res.ok) {
      this.fail((json?.message as string) ?? `Falha ao consultar transferência (HTTP ${res.status})`, res, json);
    }
    const status = (json?.status ?? (json?.withdraw as Record<string, unknown> | undefined)?.status) as string | undefined;
    if (!status) this.fail("Transferência não encontrada na AmploPay", res, json);

    return {
      providerTransactionId: (json?.id as string) ?? input.providerTransactionId,
      status: mapWithdrawStatus(status),
      raw: json ?? undefined,
    };
  }

  /** AmploPay has no cancel-transfer endpoint documented. Never actually invoked by PaymentService today. */
  async cancelWithdraw(input: { providerTransactionId: string }): Promise<CancelWithdrawResult> {
    return { cancelled: false, raw: { unsupported: true, providerTransactionId: input.providerTransactionId } };
  }

  /**
   * AmploPay signs nothing over HTTP headers — every TRANSACTION_x/TRANSFER_x
   * webhook body carries its own `token` field, validated by exact-match
   * against a secret. Their docs describe two ways to get that secret: (a)
   * register ONE webhook per event category in the AmploPay dashboard
   * (Configurações > Webhooks), which mints one static token for everything
   * sent to it, or (b) a token returned per-API-call. This provider uses (a)
   * — the admin pastes that one dashboard-issued token into the same
   * `webhookSecret` field every other gateway already uses — because (b)
   * would need a per-transaction secret store our current
   * ValidateWebhookInput (one secret per credential) has no room for.
   * `signatureHeader`/`timestampHeader` are unused: AmploPay never sends
   * either, so the webhook route always passes signatureHeader as null for
   * this provider — validation reads `token` out of the parsed body instead.
   */
  async validateWebhook(input: ValidateWebhookInput): Promise<ValidateWebhookResult> {
    let parsed: AmploPayWebhookPayload;
    try {
      parsed = JSON.parse(input.rawBody) as AmploPayWebhookPayload;
    } catch {
      return { valid: false };
    }

    const provided = parsed.token;
    if (!provided) return { valid: false };

    const expected = input.webhookSecret;
    if (provided.length !== expected.length) return { valid: false };
    if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return { valid: false };

    const eventType = mapWebhookEventType(parsed.event);
    if (!eventType) return { valid: false };

    const relatedType: PaymentRelatedType = parsed.event.startsWith("TRANSFER_") ? "WITHDRAW" : "DEPOSIT";
    const providerTransactionId =
      relatedType === "DEPOSIT"
        ? parsed.transaction?.id
        : (parsed.withdraw?.id ?? parsed.withdraw?.transactionId);
    if (!providerTransactionId) return { valid: false };

    // `token` IS the shared webhook secret (see this method's doc comment) —
    // it must never leave this function inside `parsedPayload`, which
    // becomes the persisted, admin-visible `PaymentWebhook.payload`
    // (WebhookDispatcherService) and would otherwise leak the live secret in
    // plaintext to every AUDIT/COMPLIANCE/ADMIN viewer forever. Safe to
    // strip: `reprocess()` only replays settlement from the stored payload,
    // it never re-validates the signature against it.
    const redactedPayload: Record<string, unknown> = { ...parsed };
    delete redactedPayload.token;

    return {
      valid: true,
      eventType,
      relatedType,
      providerTransactionId,
      parsedPayload: redactedPayload,
    };
  }

  async health(): Promise<ProviderHealthResult> {
    const start = performance.now();
    try {
      const res = await this.call("/gateway/producer/balance");
      const latencyMs = Math.round(performance.now() - start);
      if (!res.ok) return { status: "DEGRADED", latencyMs, message: `HTTP ${res.status}` };
      return { status: "ONLINE", latencyMs };
    } catch (err) {
      return {
        status: "OFFLINE",
        latencyMs: Math.round(performance.now() - start),
        message: err instanceof Error ? err.message : "health check failed",
      };
    }
  }
}
