export const DEFAULT_PROMOTION_SETTINGS_ID = "global";

/** WalletTransaction.idempotencyKey for the signup-bonus credit on a given deposit — globally unique, guards against replayed depositConfirmed events. */
export function signupBonusIdempotencyKey(depositId: string): string {
  return `promo:${depositId}:signup-bonus`;
}
