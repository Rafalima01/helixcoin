import type { LedgerEntry } from "@/modules/ledger/entities/ledger-entry.entity";

/** Admin-only — Ledger has no player-facing read surface. */
export interface LedgerEntryDto {
  id: string;
  transactionId: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  currency: string;
  reference: string | null;
  referenceType: string | null;
  description: string | null;
  createdAt: string;
}

export function toLedgerEntryDto(entity: LedgerEntry): LedgerEntryDto {
  return {
    id: entity.id,
    transactionId: entity.transactionId,
    debitAccount: entity.debitAccount,
    creditAccount: entity.creditAccount,
    amount: entity.amount,
    currency: entity.currency,
    reference: entity.reference,
    referenceType: entity.referenceType,
    description: entity.description,
    createdAt: entity.createdAt.toISOString(),
  };
}
