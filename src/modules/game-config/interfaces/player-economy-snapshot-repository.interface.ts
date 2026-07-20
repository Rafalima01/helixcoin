export interface PlayerEconomySnapshot {
  tags: string[];
  /** Wallet.balance, cents. */
  balance: number;
  /** Sum of the user's COMPLETED WITHDRAW transactions, cents. */
  totalWithdrawn: number;
}

/**
 * Read-only view over data owned by other parts of the schema (User.tags,
 * Wallet, Transaction) that `resolveModeForUser` needs. Kept behind an
 * interface — same reason as the repository pattern elsewhere in this
 * module — so mode-resolution logic is unit-testable without a database.
 */
export interface IPlayerEconomySnapshotRepository {
  getSnapshot(userId: string): Promise<PlayerEconomySnapshot>;
}
