/**
 * Deterministic idempotency-key scheme, same "parallel to match-engine's
 * `match:{id}:bet` convention" this codebase uses everywhere a WalletService
 * call needs replay-safety (see src/modules/payments/constants/payments.constants.ts's
 * PAYMENT_IDEMPOTENCY_KEYS, which this mirrors 1:1 for the commercial flow).
 */
export const COMMERCIAL_WITHDRAW_IDEMPOTENCY_KEYS = {
  lock: (withdrawId: string) => `commercial-withdraw:${withdrawId}:lock`,
  approve: (withdrawId: string) => `commercial-withdraw:${withdrawId}:approve`,
  unlockReject: (withdrawId: string) => `commercial-withdraw:${withdrawId}:unlock-reject`,
} as const;

/** CacheService.withLock key for CommercialWithdrawService.request — same A6 double-click/retry protection as payments' withdrawCreateLockKey. */
export const commercialWithdrawCreateLockKey = (userId: string) => `commercial-withdraw:create:${userId}`;

/** Same generous upper bound reasoning as payments' WITHDRAW_CREATE_LOCK_TTL_MS — this flow has no gateway round-trip at all (admin-approved, not automatic), so the real critical section is much shorter, but the TTL is kept identical for consistency and to comfortably survive GC pauses/slow DB round-trips. */
export const COMMERCIAL_WITHDRAW_CREATE_LOCK_TTL_MS = 90_000;
