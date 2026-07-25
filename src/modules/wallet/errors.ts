/**
 * Thrown by IWalletRepository implementations when a WalletTransaction
 * insert loses an idempotency-key race (two callers passed the
 * "does this key exist yet?" pre-check before either finished writing).
 * WalletService catches this specifically and recovers by re-fetching and
 * returning the transaction that won the race — never lets it surface as a
 * generic error.
 */
export class IdempotencyConflictError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`Idempotency key already used: ${idempotencyKey}`);
    this.name = "IdempotencyConflictError";
  }
}
