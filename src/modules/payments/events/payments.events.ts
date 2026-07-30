/** Extension points — nothing subscribes yet (no real notifications this phase), same "publish now, wire consumers later" convention as WALLET_EVENTS/LEDGER_EVENTS. */
export const PAYMENT_EVENTS = {
  depositCreated: "payments.deposit.created",
  depositPending: "payments.deposit.pending",
  depositConfirmed: "payments.deposit.confirmed",
  /** Terminal failure only — CANCELLED/EXPIRED/REFUNDED are now their own distinct events below (Fase 10; previously all three fired this same event). */
  depositFailed: "payments.deposit.failed",
  depositCancelled: "payments.deposit.cancelled",
  depositExpired: "payments.deposit.expired",
  /** Status-only — never implies a wallet debit. See PaymentService.settle's "deposit.refunded" case. */
  depositRefunded: "payments.deposit.refunded",
  withdrawRequested: "payments.withdraw.requested",
  withdrawApproved: "payments.withdraw.approved",
  withdrawRejected: "payments.withdraw.rejected",
  webhookReceived: "payments.webhook.received",
  /** A delivery matched an already-recorded PaymentWebhook (by providerEventId or payloadHash) instead of creating a new one — the "webhook duplicado" simulator scenario. */
  webhookDuplicate: "payments.webhook.duplicate",
  /** A validly-signed webhook arrived for a Deposit/Withdraw that had already left the state it expects (e.g. a "rejected" landing after the withdraw was already APPROVED) — settle()'s status guard turned it into a no-op. The "webhook fora de ordem" simulator scenario. */
  webhookOutOfOrder: "payments.webhook.out_of_order",
  /** Equivalent to "GatewayOffline"/"GatewayRecovered" from the Fase 10 spec — kept under their original Fase 7 names (health-check-driven, published by GatewayRouterService.recordHealthCheck). */
  gatewayUnavailable: "payments.gateway.unavailable",
  gatewayRecovered: "payments.gateway.recovered",
  /** Published by PaymentService.withFailover — one candidate's single attempt (health()-independent; this is an outbound-call-level event). */
  gatewayTimeout: "payments.gateway.timeout",
  gatewayRetry: "payments.gateway.retry",
  gatewayFailover: "payments.gateway.failover",
} as const;

export interface DepositEventPayload {
  depositId: string;
  userId: string;
  amountCents: number;
  gatewayCredentialId: string;
  status: string;
}

export interface WithdrawEventPayload {
  withdrawId: string;
  userId: string;
  amountCents: number;
  gatewayCredentialId: string;
  status: string;
}

export interface WebhookEventPayload {
  webhookId: string;
  provider: string;
  eventType: string;
  relatedType: string;
  relatedId: string;
}

export interface WebhookOutOfOrderEventPayload {
  webhookId: string;
  relatedType: string;
  relatedId: string;
  currentStatus: string;
  attemptedEventType: string;
}

export interface GatewayHealthEventPayload {
  gatewayCredentialId: string;
  provider: string;
  status: string;
  previousStatus: string | null;
}

/** correlationId is always the Deposit/Withdraw id — see the Fase 10 correlationId chain doc comment on PaymentService.withFailover. */
export interface GatewayRetryEventPayload {
  gatewayCredentialId: string;
  provider: string;
  correlationId: string;
  attempt: number;
  maxRetries: number;
}

export interface GatewayTimeoutEventPayload {
  gatewayCredentialId: string;
  provider: string;
  correlationId: string;
  attempt: number;
  timeoutMs: number;
}

export interface GatewayFailoverEventPayload {
  fromGatewayCredentialId: string;
  toGatewayCredentialId: string | null;
  provider: string;
  correlationId: string;
  reason: string;
}
