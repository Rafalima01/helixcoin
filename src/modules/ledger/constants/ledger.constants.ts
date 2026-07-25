/** Fixed system-side ledger accounts — the non-wallet side of most double-entry pairs. */
export const SYSTEM_ACCOUNTS = {
  platform: "PLATFORM",
  bonusPool: "BONUS_POOL",
  cashbackPool: "CASHBACK_POOL",
  commissionPool: "COMMISSION_POOL",
  adjustment: "ADJUSTMENT",
} as const;

export type WalletLedgerBucket = "MAIN" | "LOCKED" | "BONUS";

/** Canonical ledger account code for a player wallet's given balance bucket. */
export function walletAccountCode(userId: string, bucket: WalletLedgerBucket): string {
  return `WALLET:${userId}:${bucket}`;
}

/** BRL only in practice this phase — LedgerEntry.currency is a plain string so a second currency needs no migration later. */
export const DEFAULT_CURRENCY = "BRL";
