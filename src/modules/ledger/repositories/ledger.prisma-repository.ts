import type { LedgerEntry as PrismaLedgerEntry, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ILedgerRepository,
  CreateLedgerEntryInput,
  LedgerListFilter,
} from "@/modules/ledger/interfaces/ledger-repository.interface";
import type { LedgerEntry } from "@/modules/ledger/entities/ledger-entry.entity";
import { DEFAULT_CURRENCY } from "@/modules/ledger/constants/ledger.constants";

function toEntity(row: PrismaLedgerEntry): LedgerEntry {
  return {
    id: row.id,
    transactionId: row.transactionId,
    debitAccount: row.debitAccount,
    creditAccount: row.creditAccount,
    amount: row.amount,
    currency: row.currency,
    reference: row.reference,
    referenceType: row.referenceType,
    description: row.description,
    createdAt: row.createdAt,
  };
}

export class PrismaLedgerRepository implements ILedgerRepository {
  /** Accepts the caller's open transaction client so a LedgerEntry write always commits atomically with the WalletTransaction/balance change that produced it. */
  async createEntry(input: CreateLedgerEntryInput, tx?: Prisma.TransactionClient): Promise<LedgerEntry> {
    const client = tx ?? prisma;
    const row = await client.ledgerEntry.create({
      data: {
        id: input.id,
        transactionId: input.transactionId,
        debitAccount: input.debitAccount,
        creditAccount: input.creditAccount,
        amount: input.amount,
        currency: input.currency ?? DEFAULT_CURRENCY,
        reference: input.reference ?? null,
        referenceType: input.referenceType ?? null,
        description: input.description ?? null,
      },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<LedgerEntry | null> {
    const row = await prisma.ledgerEntry.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async listForTransaction(transactionId: string): Promise<LedgerEntry[]> {
    const rows = await prisma.ledgerEntry.findMany({ where: { transactionId }, orderBy: { createdAt: "asc" } });
    return rows.map(toEntity);
  }

  async list(filter: LedgerListFilter): Promise<{ items: LedgerEntry[]; total: number }> {
    // Contas Demo ficam isoladas do ledger financeiro — account codes seguem
    // o formato "WALLET:{userId}:{bucket}" (ledger.constants.ts), então
    // excluímos qualquer entrada cujo débito/crédito referencie a wallet de
    // um usuário demo. Lista de contas demo tende a ser pequena (só
    // influenciadores/parceiros criados manualmente), então esta segunda
    // query é barata.
    const demoUsers = await prisma.user.findMany({ where: { isDemo: true }, select: { id: true } });
    const demoAccountPrefixes = demoUsers.map((u) => `WALLET:${u.id}:`);

    const where: Prisma.LedgerEntryWhereInput = {
      ...(demoAccountPrefixes.length > 0
        ? {
            AND: demoAccountPrefixes.flatMap((prefix) => [
              { NOT: { debitAccount: { startsWith: prefix } } },
              { NOT: { creditAccount: { startsWith: prefix } } },
            ]),
          }
        : {}),
      ...(filter.debitAccount ? { debitAccount: filter.debitAccount } : {}),
      ...(filter.creditAccount ? { creditAccount: filter.creditAccount } : {}),
      ...(filter.reference ? { reference: filter.reference } : {}),
      ...(filter.referenceType ? { referenceType: filter.referenceType } : {}),
      ...(filter.from || filter.to
        ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.ledgerEntry.count({ where }),
    ]);

    return { items: rows.map(toEntity), total };
  }
}
