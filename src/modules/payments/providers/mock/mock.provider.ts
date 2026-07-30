import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { ExternalServiceError, UnauthorizedError } from "@/server/errors";
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
import type { GatewayHealthStatus, GatewaySimulatedFault, PaymentRelatedType } from "@/modules/payments/entities/payments.entity";
import { MOCK_WEBHOOK_SIGNATURE_HEADER, MOCK_TIMEOUT_FAULT_DELAY_MS } from "@/modules/payments/constants/payments.constants";

interface MockWebhookPayload {
  eventId: string;
  eventType: string;
  relatedType: PaymentRelatedType;
  relatedId: string;
  providerTransactionId: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface BuildWebhookPayloadInput {
  eventType: string;
  relatedType: PaymentRelatedType;
  relatedId: string;
  providerTransactionId: string;
  webhookSecret: string;
  extra?: Record<string, unknown>;
}

export interface BuiltWebhookPayload {
  rawBody: string;
  signatureHeader: string;
  headerName: typeof MOCK_WEBHOOK_SIGNATURE_HEADER;
  providerEventId: string;
}

function sign(rawBody: string, webhookSecret: string): string {
  return createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
}

/** Deterministic fake EMV-ish PIX copy-paste code — well-formed enough to display/copy, never a real payment rail. */
function buildFakePixCode(depositId: string, amountCents: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let seed = 0;
  for (let i = 0; i < depositId.length; i++) seed = (seed * 31 + depositId.charCodeAt(i)) >>> 0;
  let code = "00020126580014BR.GOV.BCB.PIX";
  for (let i = 0; i < 32; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    code += chars[seed % chars.length];
  }
  code += `5204000053039865${String(amountCents).padStart(4, "0")}`;
  return code;
}

/**
 * The only functional PaymentProvider this phase. Fully deterministic and
 * self-contained — no external network calls, no persisted state of its
 * own (Deposit/Withdraw rows are PaymentService's job). `getDeposit`/
 * `getWithdraw` always report PENDING since Mock never independently tracks
 * settlement — this system settles exclusively through
 * `PaymentService.handleWebhook`, fed either by the player/admin "simulate"
 * actions (via `buildWebhookPayload`) or, in principle, a real webhook POST
 * carrying the same signed shape.
 */
export class MockProvider implements PaymentProvider {
  readonly name = "MOCK" as const;

  constructor(
    private readonly params: {
      webhookSecret: string;
      simulatedHealth: GatewayHealthStatus | null;
      simulatedErrorMode?: GatewaySimulatedFault | null;
    }
  ) {}

  /**
   * Applied at the top of every OUTBOUND call — distinct from
   * `simulatedHealth`, which only shapes `health()`'s own reported status.
   * This is what lets the admin "Gateways" screen exercise
   * PaymentService's real retry/timeout/failover logic on demand, fully
   * offline (TIMEOUT is a local setTimeout, never a real network wait).
   */
  private async applyFault(): Promise<void> {
    switch (this.params.simulatedErrorMode) {
      case "OFFLINE_CALLS":
        throw new ExternalServiceError("MOCK", "Gateway MOCK simulando indisponibilidade (simulatedErrorMode=OFFLINE_CALLS)");
      case "ERROR_500":
        throw new ExternalServiceError("MOCK", "Gateway MOCK simulando erro interno (simulatedErrorMode=ERROR_500)");
      case "AUTH_ERROR":
        throw new UnauthorizedError("Gateway MOCK simulando falha de autenticação (simulatedErrorMode=AUTH_ERROR)");
      case "TIMEOUT":
        await new Promise((resolve) => setTimeout(resolve, MOCK_TIMEOUT_FAULT_DELAY_MS));
        return;
      default:
        return;
    }
  }

  async createPixDeposit(input: CreatePixDepositInput): Promise<CreatePixDepositResult> {
    await this.applyFault();
    return {
      providerTransactionId: `mock_dep_${input.depositId}`,
      pixCode: buildFakePixCode(input.depositId, input.amountCents),
      expiresAt: input.expiresAt,
      raw: { mock: true, depositId: input.depositId },
    };
  }

  async getDeposit(input: { providerTransactionId: string }): Promise<GetDepositResult> {
    await this.applyFault();
    return {
      providerTransactionId: input.providerTransactionId,
      status: "PENDING",
      raw: { mock: true, note: "Mock has no independent state — settlement only happens via handleWebhook." },
    };
  }

  async cancelDeposit(input: { providerTransactionId: string }): Promise<CancelDepositResult> {
    await this.applyFault();
    return { cancelled: true, raw: { mock: true, providerTransactionId: input.providerTransactionId } };
  }

  async createWithdraw(input: CreateWithdrawInput): Promise<CreateWithdrawResult> {
    await this.applyFault();
    return {
      providerTransactionId: `mock_wd_${input.withdrawId}`,
      status: "PENDING",
      raw: { mock: true, withdrawId: input.withdrawId },
    };
  }

  async getWithdraw(input: { providerTransactionId: string }): Promise<GetWithdrawResult> {
    await this.applyFault();
    return {
      providerTransactionId: input.providerTransactionId,
      status: "PENDING",
      raw: { mock: true, note: "Mock has no independent state — settlement only happens via handleWebhook." },
    };
  }

  async cancelWithdraw(input: { providerTransactionId: string }): Promise<CancelWithdrawResult> {
    await this.applyFault();
    return { cancelled: true, raw: { mock: true, providerTransactionId: input.providerTransactionId } };
  }

  async validateWebhook(input: ValidateWebhookInput): Promise<ValidateWebhookResult> {
    const provided = input.signatureHeader;
    if (!provided) return { valid: false };

    const expected = sign(input.rawBody, this.params.webhookSecret);
    // Length check before Buffer.from — same guard as server/security/csrf.ts's verifyCsrfToken,
    // timingSafeEqual throws on mismatched lengths instead of returning false.
    if (provided.length !== expected.length) return { valid: false };
    if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return { valid: false };

    let parsed: MockWebhookPayload;
    try {
      parsed = JSON.parse(input.rawBody) as MockWebhookPayload;
    } catch {
      return { valid: false };
    }

    return {
      valid: true,
      eventType: parsed.eventType,
      relatedType: parsed.relatedType,
      providerTransactionId: parsed.providerTransactionId,
      providerEventId: parsed.eventId,
      parsedPayload: parsed,
    };
  }

  async health(): Promise<ProviderHealthResult> {
    return { status: this.params.simulatedHealth ?? "ONLINE", latencyMs: 1 };
  }

  /**
   * Not part of the PaymentProvider interface — the one source of truth both
   * `validateWebhook` and the player/admin "simulate" controllers use for
   * webhook payload shape + signing, so a simulated delivery is byte-for-byte
   * what a real signed webhook would look like.
   */
  static buildWebhookPayload(input: BuildWebhookPayloadInput): BuiltWebhookPayload {
    const providerEventId = `evt_${randomUUID()}`;
    const payload: MockWebhookPayload = {
      eventId: providerEventId,
      eventType: input.eventType,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      providerTransactionId: input.providerTransactionId,
      timestamp: new Date().toISOString(),
      ...input.extra,
    };
    const rawBody = JSON.stringify(payload);
    return {
      rawBody,
      signatureHeader: sign(rawBody, input.webhookSecret),
      headerName: MOCK_WEBHOOK_SIGNATURE_HEADER,
      providerEventId,
    };
  }
}
