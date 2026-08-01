import type { DepositQuickAmount } from "@/modules/promotions/entities/promotions.entity";

export const DEFAULT_PROMOTION_SETTINGS_ID = "global";

/** Falls back to this when PromotionSettings.depositQuickAmounts is null/empty — mirrors the Deposit screen's previous hardcoded QUICK_AMOUNTS row (cents). */
export const DEFAULT_DEPOSIT_QUICK_AMOUNTS: DepositQuickAmount[] = [
  { amountCents: 5000, enabled: true, highlightEnabled: false, highlightLabel: null },
  { amountCents: 10000, enabled: true, highlightEnabled: false, highlightLabel: null },
  { amountCents: 20000, enabled: true, highlightEnabled: false, highlightLabel: null },
  { amountCents: 50000, enabled: true, highlightEnabled: false, highlightLabel: null },
];

/** WalletTransaction.idempotencyKey for the signup-bonus credit on a given deposit — globally unique, guards against replayed depositConfirmed events. */
export function signupBonusIdempotencyKey(depositId: string): string {
  return `promo:${depositId}:signup-bonus`;
}
