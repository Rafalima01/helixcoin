/**
 * Thrown by IPaymentWebhookRepository implementations when a PaymentWebhook
 * insert loses a providerEventId race (two concurrent deliveries of the
 * same event both passed the "does this eventId exist yet?" pre-check
 * before either finished writing) — same shape and same reason as
 * IdempotencyConflictError in src/modules/wallet/errors.ts. PaymentService
 * catches this specifically and recovers by re-fetching the row that won
 * the race instead of letting it surface as a generic error.
 */
export class WebhookConflictError extends Error {
  constructor(readonly providerEventId: string) {
    super(`Webhook providerEventId already used: ${providerEventId}`);
    this.name = "WebhookConflictError";
  }
}

/**
 * Thrown internally by PaymentService.withTimeout when a single gateway
 * attempt exceeds the candidate's `timeoutMs` (Fase 10) — caught by
 * `withFailover`'s retry loop, never surfaces past it. Distinguishing this
 * from a generic provider failure is what lets `withFailover` log
 * "timeout after Xms" and publish PAYMENT_EVENTS.gatewayTimeout specifically,
 * instead of a generic error message.
 */
export class GatewayTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Gateway call exceeded timeout of ${timeoutMs}ms`);
    this.name = "GatewayTimeoutError";
  }
}
