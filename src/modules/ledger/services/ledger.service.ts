import type { ILedgerRepository, LedgerListFilter } from "@/modules/ledger/interfaces/ledger-repository.interface";
import type { LedgerEntry } from "@/modules/ledger/entities/ledger-entry.entity";

/**
 * Read-only by design — this is the entire enforcement mechanism for
 * "Ledger must never be edited": there is no create/update method on this
 * service, anywhere. The only writer of LedgerEntry rows is
 * WalletService, via ILedgerRepository.createEntry() called from inside
 * its own locked transaction — never through here.
 */
export class LedgerService {
  constructor(private readonly ledger: ILedgerRepository) {}

  async getById(id: string): Promise<LedgerEntry | null> {
    return this.ledger.findById(id);
  }

  async listForTransaction(transactionId: string): Promise<LedgerEntry[]> {
    return this.ledger.listForTransaction(transactionId);
  }

  async list(filter: LedgerListFilter): Promise<{ items: LedgerEntry[]; total: number }> {
    return this.ledger.list(filter);
  }
}
