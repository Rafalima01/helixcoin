import type {
  ILedgerRepository,
  CreateLedgerEntryInput,
  LedgerListFilter,
} from "@/modules/ledger/interfaces/ledger-repository.interface";
import type { LedgerEntry } from "@/modules/ledger/entities/ledger-entry.entity";
import { DEFAULT_CURRENCY } from "@/modules/ledger/constants/ledger.constants";

/** In-memory implementation — what tests inject instead of a real database. Append-only: no method here ever mutates or removes an existing row. */
export class InMemoryLedgerRepository implements ILedgerRepository {
  private readonly rows: LedgerEntry[] = [];

  async createEntry(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
    const entry: LedgerEntry = {
      id: input.id,
      transactionId: input.transactionId,
      debitAccount: input.debitAccount,
      creditAccount: input.creditAccount,
      amount: input.amount,
      currency: input.currency ?? DEFAULT_CURRENCY,
      reference: input.reference ?? null,
      referenceType: input.referenceType ?? null,
      description: input.description ?? null,
      createdAt: new Date(),
    };
    this.rows.push(entry);
    return entry;
  }

  async findById(id: string): Promise<LedgerEntry | null> {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  async listForTransaction(transactionId: string): Promise<LedgerEntry[]> {
    return this.rows.filter((r) => r.transactionId === transactionId);
  }

  async list(filter: LedgerListFilter): Promise<{ items: LedgerEntry[]; total: number }> {
    const all = this.rows
      .filter((r) => !filter.debitAccount || r.debitAccount === filter.debitAccount)
      .filter((r) => !filter.creditAccount || r.creditAccount === filter.creditAccount)
      .filter((r) => !filter.reference || r.reference === filter.reference)
      .filter((r) => !filter.referenceType || r.referenceType === filter.referenceType)
      .filter((r) => !filter.from || r.createdAt >= filter.from)
      .filter((r) => !filter.to || r.createdAt <= filter.to)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const items = all.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize);
    return { items, total: all.length };
  }
}
