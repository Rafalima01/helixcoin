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
