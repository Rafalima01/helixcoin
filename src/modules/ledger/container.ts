import { PrismaLedgerRepository } from "@/modules/ledger/repositories/ledger.prisma-repository";
import { LedgerService } from "@/modules/ledger/services/ledger.service";

const ledgerRepository = new PrismaLedgerRepository();

export const ledgerContainer = {
  /** Exported directly (not just wrapped in the service) — WalletService's Prisma repository composes writes against this same instance from inside its own locked transaction. See ledger.service.ts's doc comment for why writes never go through LedgerService. */
  ledgerRepository,
  ledgerService: new LedgerService(ledgerRepository),
};
