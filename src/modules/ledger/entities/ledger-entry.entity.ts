/** Domain entity — append-only, see this module's README for the double-entry/creation-order convention. */
export interface LedgerEntry {
  id: string;
  /** The WalletTransaction this entry belongs to — see schema.prisma's LedgerEntry doc comment for why this is a plain string, not a relation. */
  transactionId: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  currency: string;
  reference: string | null;
  referenceType: string | null;
  description: string | null;
  createdAt: Date;
}
