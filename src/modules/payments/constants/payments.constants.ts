/**
 * Deterministic idempotency-key scheme, parallel to match-engine's
 * `match:{id}:bet` convention — every WalletService call PaymentService makes
 * passes one of these, so a replayed webhook or a retried request never
 * moves money twice.
 */
export const PAYMENT_IDEMPOTENCY_KEYS = {
  depositConfirm: (depositId: string) => `deposit:${depositId}:confirm`,
  withdrawLock: (withdrawId: string) => `withdraw:${withdrawId}:lock`,
  withdrawUnlockProviderFailure: (withdrawId: string) => `withdraw:${withdrawId}:unlock-provider-failure`,
  /** Approve settles directly out of the LOCKED bucket via debit(account:"LOCKED") — no separate unlock() step, same pattern the pre-Fase-7 simulated withdraw flow used. */
  withdrawApprove: (withdrawId: string) => `withdraw:${withdrawId}:approve`,
  withdrawUnlockReject: (withdrawId: string) => `withdraw:${withdrawId}:unlock-reject`,
  /**
   * Conta Demo simulation. Deliberately a DIFFERENT key prefix from the real
   * `withdraw:*` ones above so a simulated movement can never collide with,
   * or be mistaken for, a real settlement in the WalletTransaction ledger —
   * the key is stored on the row and is what an auditor reads.
   */
  simulatedWithdrawLock: (withdrawId: string) => `withdraw-sim:${withdrawId}:lock`,
  simulatedWithdrawApprove: (withdrawId: string) => `withdraw-sim:${withdrawId}:approve`,
  simulatedWithdrawUnlockReject: (withdrawId: string) => `withdraw-sim:${withdrawId}:unlock-reject`,
} as const;

/** Masks a PIX key for admin/player display — never the full value once persisted. */
export function maskPixKey(pixKey: string): string {
  if (pixKey.length <= 4) return "*".repeat(pixKey.length);
  const visible = pixKey.slice(-4);
  return `${"*".repeat(Math.max(pixKey.length - 4, 4))}${visible}`;
}

export const MOCK_WEBHOOK_SIGNATURE_HEADER = "x-mock-signature";

export const DEFAULT_PAYMENT_SETTINGS_ID = "global";

/** CacheService.withLock key for PaymentService.requestWithdraw — see that method's doc comment (A6: double-click/retry can never create two real withdrawals). */
export const withdrawCreateLockKey = (userId: string) => `withdraw:create:${userId}`;

/**
 * Generous upper bound on requestWithdraw's own critical section (wallet
 * lock through gateway call through Withdraw row creation) — the lock is
 * always released right after that finishes (see CacheService.withLock's
 * `finally`), so this TTL only needs to comfortably outlast the slowest
 * realistic run, not match it exactly. Worst case with default gateway
 * config (15s timeout x 3 attempts = 45s for one credential) plus normal
 * multi-candidate failover headroom — 90s leaves ample margin without
 * risking a stuck lock surviving much past an actual crash.
 */
export const WITHDRAW_CREATE_LOCK_TTL_MS = 90_000;

/**
 * How long MockProvider artificially delays an outbound call when a
 * credential's `simulatedErrorMode` is TIMEOUT — long enough to reliably
 * exceed any `timeoutMs` a test configures (tests should set `timeoutMs`
 * well below this), short enough to keep the suite fast. Stays "offline":
 * it's a local setTimeout, never a real network wait.
 */
export const MOCK_TIMEOUT_FAULT_DELAY_MS = 250;
