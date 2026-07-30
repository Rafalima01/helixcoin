import { createHmac, timingSafeEqual } from "node:crypto";
import { BusinessRuleError, ExternalServiceError } from "@/server/errors";
import { getVeoPagToken, invalidateVeoPagToken, VEOPAG_BASE_URL } from "@/modules/payments/providers/veopag/veopag-auth";
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

export const VEOPAG_WEBHOOK_SIGNATURE_HEADER = "x-webhook-signature";
export const VEOPAG_WEBHOOK_TIMESTAMP_HEADER = "x-webhook-timestamp";

/** VeoPag replay-protection window recommended in their webhook guide. */
const WEBHOOK_MAX_CLOCK_SKEW_SECONDS = 300;

type VeoPagKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

/** VeoPag amounts are decimal BRL (e.g. `100.00`), never cents — this is the only place that conversion happens. */
function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}

function mapKeyType(pixKeyType: string | undefined): VeoPagKeyType {
  switch (pixKeyType) {
    case "RANDOM":
      return "EVP";
    case "CPF":
    case "CNPJ":
    case "EMAIL":
    case "PHONE":
      return pixKeyType;
    default:
      throw new BusinessRuleError("Tipo de chave PIX é obrigatório para saques via VeoPag");
  }
}

function mapDepositStatus(status: string): DepositStatus {
  switch (status) {
    case "COMPLETED":
      return "PAID";
    case "FAILED":
      return "FAILED";
    case "PROCESSING":
      return "PROCESSING";
    default:
      return "PENDING";
  }
}

function mapWithdrawStatus(status: string): WithdrawStatus {
  switch (status) {
    case "COMPLETED":
      return "APPROVED";
    case "FAILED":
    // No direct WithdrawStatus equivalent for a post-completion reversal —
    // the raw payload (logged) still carries the real VeoPag status.
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "FAILED";
    case "QUEUE":
    case "PROCESSING":
      return "PROCESSING";
    default:
      return "PENDING";
  }
}

/** deposit.paid/deposit.failed/withdraw.approved/withdraw.rejected are the only canonical events PaymentService.settle() knows how to act on — PENDING/PROCESSING/QUEUE webhook deliveries are intentionally treated as "not yet actionable" (a later delivery or the reconciliation job settles them) rather than forced into a fake event. */
function mapWebhookEventType(relatedType: PaymentRelatedType, status: string): string | null {
  if (relatedType === "DEPOSIT") {
    if (status === "COMPLETED") return "deposit.paid";
    if (status === "FAILED") return "deposit.failed";
    return null;
  }
  if (status === "COMPLETED") return "withdraw.approved";
  if (status === "FAILED") return "withdraw.rejected";
  return null;
}

interface VeoPagWebhookPayload {
  type: "Deposit" | "Withdrawal";
  external_id?: string;
  transaction_id: string;
  status: string;
  amount: number;
  fee?: number;
  [key: string]: unknown;
}

export interface BuildReconciliationWebhookInput {
  relatedType: PaymentRelatedType;
  providerTransactionId: string;
  externalId?: string;
  status: "COMPLETED" | "FAILED";
  amount: number;
  fee?: number;
  webhookSecret: string;
}

export interface BuiltReconciliationWebhook {
  rawBody: string;
  signatureHeader: string;
  timestampHeader: string;
}

/**
 * The only functional PaymentProvider besides MOCK. Talks to the real
 * VeoPag REST API (`https://api.veopag.com`, no sandbox — see
 * HOSTINGER_DEPLOY.md-style docs mapped into this integration). Token
 * management lives in veopag-auth.ts (Redis-cached, shared across every
 * fresh instance ProviderFactory.create() hands out).
 */
export class VeoPagProvider implements PaymentProvider {
  readonly name = "VEOPAG" as const;

  constructor(
    private readonly params: {
      credentialId: string;
      clientId: string;
      clientSecret: string;
    }
  ) {}

  private async authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const { credentialId, clientId, clientSecret } = this.params;
    const call = async (token: string) =>
      fetch(`${VEOPAG_BASE_URL}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${token}` },
      });

    const token = await getVeoPagToken(credentialId, clientId, clientSecret);
    const res = await call(token);
    if (res.status !== 401) return res;

    // Cached token was revoked/stale server-side — log in once more and retry exactly once.
    await invalidateVeoPagToken(credentialId);
    const freshToken = await getVeoPagToken(credentialId, clientId, clientSecret);
    return call(freshToken);
  }

  private async readJson(res: Response): Promise<Record<string, unknown> | null> {
    try {
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async createPixDeposit(input: CreatePixDepositInput): Promise<CreatePixDepositResult> {
    const body = {
      amount: centsToAmount(input.amountCents),
      external_id: input.depositId,
      payer: {
        name: input.payerName || "Pagamento Digital",
        email: input.payerEmail || "noreply@pagamento.digital",
        // Intentionally invalid when absent — VeoPag documents an automatic
        // fallback to a generic valid CPF for invalid/missing documents, so
        // that a player with no CPF on file can still pay.
        document: input.payerDocument || "00000000000",
      },
    };

    const res = await this.authorizedFetch("/api/payments/deposit", { method: "POST", body: JSON.stringify(body) });
    const json = await this.readJson(res);
    if (!res.ok) {
      throw new ExternalServiceError("VEOPAG", (json?.message as string) ?? `Falha ao criar cobrança (HTTP ${res.status})`);
    }

    // A fresh charge (201) wraps its fields in `qrCodeResponse`; a replayed
    // `external_id` (200, idempotent) returns them flat instead.
    const qr = (json?.qrCodeResponse as Record<string, unknown> | undefined) ?? json ?? {};
    const providerTransactionId = (qr.transactionId ?? qr.transaction_id) as string | undefined;
    const pixCode = qr.qrcode as string | undefined;
    if (!providerTransactionId || !pixCode) {
      throw new ExternalServiceError("VEOPAG", "Resposta de criação de cobrança sem transactionId/qrcode");
    }

    return { providerTransactionId, pixCode, expiresAt: input.expiresAt, raw: json ?? undefined };
  }

  async getDeposit(input: { providerTransactionId: string }): Promise<GetDepositResult> {
    const res = await this.authorizedFetch(
      `/api/transactions/deposit?transaction_id=${encodeURIComponent(input.providerTransactionId)}`
    );
    const json = await this.readJson(res);
    if (!res.ok) {
      throw new ExternalServiceError("VEOPAG", (json?.message as string) ?? `Falha ao consultar depósito (HTTP ${res.status})`);
    }
    const deposit = json?.deposit as Record<string, unknown> | null | undefined;
    if (!deposit) throw new ExternalServiceError("VEOPAG", "Depósito não encontrado na VeoPag");

    const status = deposit.status as string;
    return {
      providerTransactionId: deposit.transaction_id as string,
      status: mapDepositStatus(status),
      paidAmountCents: status === "COMPLETED" ? amountToCents(deposit.amount as number) : undefined,
      raw: deposit,
    };
  }

  /** VeoPag has no cancel-charge endpoint — PIX QR codes just expire on their own. Never actually invoked by PaymentService today (see the interface's own doc comment). */
  async cancelDeposit(input: { providerTransactionId: string }): Promise<CancelDepositResult> {
    return { cancelled: false, raw: { unsupported: true, providerTransactionId: input.providerTransactionId } };
  }

  async createWithdraw(input: CreateWithdrawInput): Promise<CreateWithdrawResult> {
    const keyType = mapKeyType(input.pixKeyType);
    const needsTaxId = keyType === "EMAIL" || keyType === "PHONE" || keyType === "EVP";
    if (needsTaxId && !input.payeeDocument) {
      throw new BusinessRuleError("CPF/CNPJ do titular é obrigatório para saque por email, telefone ou chave aleatória");
    }

    const body: Record<string, unknown> = {
      amount: centsToAmount(input.amountCents),
      external_id: input.withdrawId,
      pix_key: input.pixKey,
      key_type: keyType,
      name: input.payeeName || "Titular da conta",
    };
    if (input.payeeDocument) body.taxId = input.payeeDocument;

    const res = await this.authorizedFetch("/api/withdrawals/withdraw", { method: "POST", body: JSON.stringify(body) });
    const json = await this.readJson(res);
    if (!res.ok) {
      throw new ExternalServiceError("VEOPAG", (json?.message as string) ?? `Falha ao solicitar saque (HTTP ${res.status})`);
    }

    const w = (json?.withdrawal as Record<string, unknown> | undefined) ?? json ?? {};
    const providerTransactionId = w.transaction_id as string | undefined;
    if (!providerTransactionId) throw new ExternalServiceError("VEOPAG", "Resposta de saque sem transaction_id");

    return { providerTransactionId, status: mapWithdrawStatus((w.status as string) ?? "PENDING"), raw: json ?? undefined };
  }

  async getWithdraw(input: { providerTransactionId: string }): Promise<GetWithdrawResult> {
    const res = await this.authorizedFetch(
      `/api/transactions/withdraw?transaction_id=${encodeURIComponent(input.providerTransactionId)}`
    );
    const json = await this.readJson(res);
    if (!res.ok) {
      throw new ExternalServiceError("VEOPAG", (json?.message as string) ?? `Falha ao consultar saque (HTTP ${res.status})`);
    }
    const withdraw = json?.withdraw as Record<string, unknown> | null | undefined;
    if (!withdraw) throw new ExternalServiceError("VEOPAG", "Saque não encontrado na VeoPag");

    return {
      providerTransactionId: withdraw.transaction_id as string,
      status: mapWithdrawStatus(withdraw.status as string),
      raw: withdraw,
    };
  }

  /** VeoPag has no cancel-withdrawal endpoint — withdrawals resolve on their own (COMPLETED/FAILED). Never actually invoked by PaymentService today. */
  async cancelWithdraw(input: { providerTransactionId: string }): Promise<CancelWithdrawResult> {
    return { cancelled: false, raw: { unsupported: true, providerTransactionId: input.providerTransactionId } };
  }

  async validateWebhook(input: ValidateWebhookInput): Promise<ValidateWebhookResult> {
    const { rawBody, signatureHeader, webhookSecret, timestampHeader } = input;
    if (!signatureHeader || !timestampHeader) return { valid: false };

    const timestampSeconds = Number(timestampHeader);
    if (!Number.isFinite(timestampSeconds)) return { valid: false };
    if (Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > WEBHOOK_MAX_CLOCK_SKEW_SECONDS) return { valid: false };

    const expected = createHmac("sha256", webhookSecret).update(`${timestampHeader}.${rawBody}`).digest("hex");
    if (signatureHeader.length !== expected.length) return { valid: false };
    if (!timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected))) return { valid: false };

    let parsed: VeoPagWebhookPayload;
    try {
      parsed = JSON.parse(rawBody) as VeoPagWebhookPayload;
    } catch {
      return { valid: false };
    }

    const relatedType: PaymentRelatedType = parsed.type === "Deposit" ? "DEPOSIT" : "WITHDRAW";
    const eventType = mapWebhookEventType(relatedType, parsed.status);
    if (!eventType) return { valid: false };

    return {
      valid: true,
      eventType,
      relatedType,
      providerTransactionId: parsed.transaction_id,
      parsedPayload: parsed as unknown as Record<string, unknown>,
    };
  }

  async health(): Promise<ProviderHealthResult> {
    const start = performance.now();
    try {
      const res = await this.authorizedFetch("/api/accounts/balance");
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

  /**
   * Not part of the PaymentProvider interface — used by the reconciliation
   * job (payment-reconciliation.service.ts) to feed a status change it
   * found via getDeposit/getWithdraw through the exact same
   * PaymentService.handleWebhook path a real VeoPag webhook would use,
   * mirroring MockProvider.buildWebhookPayload's "simulate a real signed
   * delivery" pattern.
   */
  static buildReconciliationWebhook(input: BuildReconciliationWebhookInput): BuiltReconciliationWebhook {
    const timestampHeader = Math.floor(Date.now() / 1000).toString();
    const payload: VeoPagWebhookPayload =
      input.relatedType === "DEPOSIT"
        ? {
            type: "Deposit",
            external_id: input.externalId,
            transaction_id: input.providerTransactionId,
            status: input.status,
            amount: input.amount,
            fee: input.fee ?? 0,
          }
        : {
            type: "Withdrawal",
            transaction_id: input.providerTransactionId,
            status: input.status,
            amount: input.amount,
            fee: input.fee ?? 0,
          };

    const rawBody = JSON.stringify(payload);
    const signatureHeader = createHmac("sha256", input.webhookSecret).update(`${timestampHeader}.${rawBody}`).digest("hex");
    return { rawBody, signatureHeader, timestampHeader };
  }
}
