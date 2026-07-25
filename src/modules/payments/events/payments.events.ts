/** Extension points — nothing subscribes yet (no real notifications this phase), same "publish now, wire consumers later" convention as WALLET_EVENTS/LEDGER_EVENTS. */
export const PAYMENT_EVENTS = {
  depositCreated: "payments.deposit.created",
  depositPending: "payments.deposit.pending",
  depositConfirmed: "payments.deposit.confirmed",
  depositFailed: "payments.deposit.failed",
  withdrawRequested: "payments.withdraw.requested",
  withdrawApproved: "payments.withdraw.approved",
  withdrawRejected: "payments.withdraw.rejected",
  webhookReceived: "payments.webhook.received",
  gatewayUnavailable: "payments.gateway.unavailable",
  gatewayRecovered: "payments.gateway.recovered",
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

export interface GatewayHealthEventPayload {
  gatewayCredentialId: string;
  provider: string;
  status: string;
  previousStatus: string | null;
}
