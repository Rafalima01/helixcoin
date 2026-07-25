export interface WalletMoveResult {
  balanceBefore: number;
  balanceAfter: number;
}

/**
 * Thin seam over the real financial core (src/modules/wallet) — exists so
 * MatchEngineService depends on an interface instead of importing
 * walletContainer directly, same reason every other repository in this
 * codebase is behind one, and so match-engine's own unit tests keep using
 * InMemoryWalletLedger unchanged. PrismaWalletLedger's methods delegate to
 * WalletService.debit/credit/refund — no balance math happens in this
 * module anymore (Fase 6).
 */
export interface IWalletLedger {
  getBalance(userId: string): Promise<number>;
  /** Throws BusinessRuleError if the balance is insufficient. */
  debitForBet(userId: string, amountCents: number, matchId: string): Promise<WalletMoveResult>;
  creditForPayout(userId: string, amountCents: number, matchId: string): Promise<WalletMoveResult>;
  /** Cancelled ("forfeit") or Anti-Cheat-invalidated matches refund the bet — `reason` is stored on the WalletTransaction for the audit trail. */
  refundBet(userId: string, amountCents: number, matchId: string, reason: string): Promise<WalletMoveResult>;
}
