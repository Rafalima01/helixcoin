import type { TransactionType, WalletAccount } from "@prisma/client";
import { SYSTEM_ACCOUNTS, DEFAULT_CURRENCY } from "@/modules/ledger/constants/ledger.constants";

export { DEFAULT_CURRENCY };

/**
 * The fixed system-side account for every TransactionType's ledger pair.
 * The wallet side is resolved per-call via walletAccountCode(userId, account)
 * (src/modules/ledger/constants) — this table only covers the OTHER side.
 *
 * Not every type is wired to a real route yet (BONUS/CASHBACK/COMMISSION/
 * EXPIRATION) — the mapping exists so future modules only need to call
 * credit()/debit() with the right type, no WalletService changes.
 *
 * TRANSFER/LOCK/UNLOCK never actually use this map — transfer() links two
 * wallets' own accounts directly, lock()/unlock() move within a single
 * wallet's own MAIN<->LOCKED accounts — both cases have no system-account
 * side. Entries exist here only so the Record is total (every TransactionType
 * has a lookup), never read for those three types.
 */
export const SYSTEM_ACCOUNT_FOR_TYPE: Record<TransactionType, string> = {
  BET: SYSTEM_ACCOUNTS.platform,
  BET_REFUND: SYSTEM_ACCOUNTS.platform,
  PAYOUT: SYSTEM_ACCOUNTS.platform,
  DEPOSIT: SYSTEM_ACCOUNTS.platform,
  DEPOSIT_PENDING: SYSTEM_ACCOUNTS.platform,
  DEPOSIT_FAILED: SYSTEM_ACCOUNTS.platform,
  WITHDRAW: SYSTEM_ACCOUNTS.platform,
  WITHDRAW_PENDING: SYSTEM_ACCOUNTS.platform,
  WITHDRAW_REJECTED: SYSTEM_ACCOUNTS.platform,
  WITHDRAW_APPROVED: SYSTEM_ACCOUNTS.platform,
  BONUS: SYSTEM_ACCOUNTS.bonusPool,
  CASHBACK: SYSTEM_ACCOUNTS.cashbackPool,
  COMMISSION: SYSTEM_ACCOUNTS.commissionPool,
  ADJUSTMENT: SYSTEM_ACCOUNTS.adjustment,
  REVERSAL: SYSTEM_ACCOUNTS.adjustment,
  SYSTEM: SYSTEM_ACCOUNTS.platform,
  MANUAL: SYSTEM_ACCOUNTS.adjustment,
  TRANSFER: SYSTEM_ACCOUNTS.platform,
  LOCK: SYSTEM_ACCOUNTS.platform,
  UNLOCK: SYSTEM_ACCOUNTS.platform,
  EXPIRATION: SYSTEM_ACCOUNTS.bonusPool,
};

export const DEFAULT_ACCOUNT: WalletAccount = "MAIN";
