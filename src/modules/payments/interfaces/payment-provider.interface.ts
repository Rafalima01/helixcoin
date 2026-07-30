import type { GatewayProvider, DepositStatus, WithdrawStatus, PaymentRelatedType } from "@/modules/payments/entities/payments.entity";

export interface CreatePixDepositInput {
  depositId: string;
  amountCents: number;
  expiresAt: Date;
  payerDocument?: string;
  payerName?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePixDepositResult {
  providerTransactionId: string;
  pixCode: string;
  qrCodeUrl?: string;
  expiresAt: Date;
  raw?: Record<string, unknown>;
}

export interface GetDepositResult {
  providerTransactionId: string;
  status: DepositStatus;
  paidAmountCents?: number;
  raw?: Record<string, unknown>;
}

export interface CancelDepositResult {
  cancelled: boolean;
  raw?: Record<string, unknown>;
}

export interface CreateWithdrawInput {
  withdrawId: string;
  amountCents: number;
  pixKey: string;
  pixKeyType?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateWithdrawResult {
  providerTransactionId: string;
  status: WithdrawStatus;
  raw?: Record<string, unknown>;
}

export interface GetWithdrawResult {
  providerTransactionId: string;
  status: WithdrawStatus;
  rejectionReason?: string;
  raw?: Record<string, unknown>;
}

export interface CancelWithdrawResult {
  cancelled: boolean;
  raw?: Record<string, unknown>;
}

export interface ValidateWebhookInput {
  rawBody: string;
  signatureHeader: string | null;
  webhookSecret: string;
}

export interface ValidateWebhookResult {
  valid: boolean;
  eventType?: string;
  relatedType?: PaymentRelatedType;
  /** The gateway-side id (Deposit/Withdraw.providerTransactionId) this event settles. */
  providerTransactionId?: string;
  /** The gateway's own event id, when supplied — primary webhook idempotency key. */
  providerEventId?: string;
  parsedPayload?: Record<string, unknown>;
}

export interface ProviderHealthResult {
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  latencyMs: number;
  message?: string;
}

/**
 * Every gateway (Mock, Cartpanda, Mercado Pago, ...) implements this exactly
 * — PaymentService and GatewayRouterService only ever depend on this
 * interface, never on a concrete provider. Only MockProvider is functional
 * this phase; every other GatewayProvider enum value resolves to
 * NotImplementedProvider (see providers/not-implemented.provider.ts).
 */
export interface PaymentProvider {
  readonly name: GatewayProvider;
  createPixDeposit(input: CreatePixDepositInput): Promise<CreatePixDepositResult>;
  getDeposit(input: { providerTransactionId: string }): Promise<GetDepositResult>;
  cancelDeposit(input: { providerTransactionId: string }): Promise<CancelDepositResult>;
  createWithdraw(input: CreateWithdrawInput): Promise<CreateWithdrawResult>;
  getWithdraw(input: { providerTransactionId: string }): Promise<GetWithdrawResult>;
  /**
   * Not yet called by PaymentService this phase — withdraws only resolve via
   * admin approve/reject (settled through a webhook, see PaymentService.
   * decideWithdraw). Exists so the SDK contract is complete for a future
   * gateway that requires an explicit cancel call before a pending withdraw
   * can be approved/rejected — not dead code, an extension point.
   */
  cancelWithdraw(input: { providerTransactionId: string }): Promise<CancelWithdrawResult>;
  validateWebhook(input: ValidateWebhookInput): Promise<ValidateWebhookResult>;
  health(): Promise<ProviderHealthResult>;
}
