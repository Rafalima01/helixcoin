import { Prisma } from "@prisma/client";
import type { Wallet as PrismaWallet, WalletTransaction as PrismaWalletTransaction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ledgerContainer } from "@/modules/ledger/container";
import { IdempotencyConflictError } from "@/modules/wallet/errors";
import type {
  IWalletRepository,
  LockedWalletCtx,
  CreateWalletTransactionInput,
  CreateLedgerEntryInput,
  WalletBalanceDelta,
  TransactionListFilter,
  WalletListFilter,
} from "@/modules/wallet/interfaces/wallet-repository.interface";
import type { WalletBalances, WalletTransaction, WalletAdminSummary } from "@/modules/wallet/entities/wallet.entity";

function toBalances(row: PrismaWallet): WalletBalances {
  return {
    userId: row.userId,
    walletId: row.id,
    main: row.balance,
    locked: row.lockedBalance,
    bonus: row.bonusBalance,
    updatedAt: row.updatedAt,
  };
}

function toTransactionEntity(row: PrismaWalletTransaction): WalletTransaction {
  return {
    id: row.id,
    walletId: row.walletId,
    userId: row.userId,
    ledgerId: row.ledgerId,
    type: row.type,
    account: row.account,
    amount: row.amount,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    origin: row.origin,
    originId: row.originId,
    description: row.description,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaWalletRepository implements IWalletRepository {
  async getOrCreateWallet(userId: string): Promise<WalletBalances> {
    const row = await prisma.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0, lockedBalance: 0, bonusBalance: 0 },
    });
    return toBalances(row);
  }

  private buildCtx(tx: Prisma.TransactionClient, userId: string, row: PrismaWallet): LockedWalletCtx {
    return {
      balances: toBalances(row),
      applyDelta: async (delta: WalletBalanceDelta) => {
        const updated = await tx.wallet.update({
          where: { userId },
          data: {
            ...(delta.main !== undefined ? { balance: { increment: delta.main } } : {}),
            ...(delta.locked !== undefined ? { lockedBalance: { increment: delta.locked } } : {}),
            ...(delta.bonus !== undefined ? { bonusBalance: { increment: delta.bonus } } : {}),
          },
        });
        return toBalances(updated);
      },
      createWalletTransaction: async (input: CreateWalletTransactionInput) => {
        try {
          const created = await tx.walletTransaction.create({
            data: {
              id: input.id,
              walletId: input.walletId,
              userId: input.userId,
              ledgerId: input.ledgerId,
              type: input.type,
              account: input.account,
              amount: input.amount,
              balanceBefore: input.balanceBefore,
              balanceAfter: input.balanceAfter,
              origin: input.origin,
              originId: input.originId ?? null,
              description: input.description ?? null,
              status: input.status ?? "COMPLETED",
              idempotencyKey: input.idempotencyKey ?? null,
              metadata: input.metadata !== undefined && input.metadata !== null ? toJson(input.metadata) : undefined,
            },
          });
          return toTransactionEntity(created);
        } catch (err) {
          // A concurrent request holding the SAME idempotencyKey won the race and committed first — recovered by WalletService, never surfaced as a generic conflict.
          if (
            input.idempotencyKey &&
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === "P2002" &&
            (err.meta?.target as string[] | undefined)?.includes("idempotencyKey")
          ) {
            throw new IdempotencyConflictError(input.idempotencyKey);
          }
          throw err;
        }
      },
      createLedgerEntry: (input: CreateLedgerEntryInput) => ledgerContainer.ledgerRepository.createEntry(input, tx),
    };
  }

  /** Ensures a zero-balance Wallet row exists, then locks it — `INSERT ... ON CONFLICT DO NOTHING` is safe under concurrent first-time callers, the following SELECT is what actually serializes them. */
  private async ensureAndLock(tx: Prisma.TransactionClient, userId: string): Promise<PrismaWallet> {
    await tx.$executeRaw`INSERT INTO "Wallet" ("id", "userId", "balance", "lockedBalance", "bonusBalance", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${userId}, 0, 0, 0, now())
      ON CONFLICT ("userId") DO NOTHING`;
    const rows = await tx.$queryRaw<PrismaWallet[]>`SELECT * FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE`;
    const row = rows[0];
    if (!row) throw new Error(`Wallet row missing for ${userId} after ensure-insert — should be unreachable`);
    return row;
  }

  async withLockedWallet<T>(userId: string, fn: (ctx: LockedWalletCtx) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      const row = await this.ensureAndLock(tx, userId);
      return fn(this.buildCtx(tx, userId, row));
    });
  }

  /** Locks both wallets in a fixed (lexicographic) order, never call-argument order, so two concurrent transfers in opposite directions can never deadlock. */
  async withLockedWalletPair<T>(
    userIdA: string,
    userIdB: string,
    fn: (ctxA: LockedWalletCtx, ctxB: LockedWalletCtx) => Promise<T>
  ): Promise<T> {
    const [first, second] = userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
    return prisma.$transaction(async (tx) => {
      const firstRow = await this.ensureAndLock(tx, first);
      const secondRow = await this.ensureAndLock(tx, second);
      const ctxFirst = this.buildCtx(tx, first, firstRow);
      const ctxSecond = this.buildCtx(tx, second, secondRow);
      const ctxA = first === userIdA ? ctxFirst : ctxSecond;
      const ctxB = first === userIdA ? ctxSecond : ctxFirst;
      return fn(ctxA, ctxB);
    });
  }

  async findTransactionByIdempotencyKey(key: string): Promise<WalletTransaction | null> {
    const row = await prisma.walletTransaction.findUnique({ where: { idempotencyKey: key } });
    return row ? toTransactionEntity(row) : null;
  }

  async getTransactionById(id: string): Promise<WalletTransaction | null> {
    const row = await prisma.walletTransaction.findUnique({ where: { id } });
    return row ? toTransactionEntity(row) : null;
  }

  async listTransactions(filter: TransactionListFilter): Promise<{ items: WalletTransaction[]; total: number }> {
    const where: Prisma.WalletTransactionWhereInput = {
      // Contas Demo nunca aparecem em relatórios/estatísticas financeiras —
      // ver isDemo no schema.prisma. Este é o listing admin (Transações);
      // a própria conta demo continua vendo seu extrato via /api/wallet
      // (filtrado por userId, não por este método).
      user: { isDemo: false },
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.origin ? { origin: filter.origin } : {}),
      ...(filter.from || filter.to
        ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
      ...(filter.minAmount !== undefined || filter.maxAmount !== undefined
        ? {
            amount: {
              ...(filter.minAmount !== undefined ? { gte: filter.minAmount } : {}),
              ...(filter.maxAmount !== undefined ? { lte: filter.maxAmount } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return { items: rows.map(toTransactionEntity), total };
  }

  async listWalletsAdmin(filter: WalletListFilter): Promise<{ items: WalletAdminSummary[]; total: number }> {
    // Contas Demo (isDemo) ficam isoladas da operação real — visíveis apenas
    // no admin dedicado /admin/demo-accounts, nunca no listing financeiro geral.
    const where: Prisma.WalletWhereInput = {
      user: { isDemo: false },
      ...(filter.search
        ? {
            OR: [
              { userId: filter.search },
              {
                user: {
                  OR: [
                    { email: { contains: filter.search, mode: "insensitive" } },
                    { username: { contains: filter.search, mode: "insensitive" } },
                    { firstName: { contains: filter.search, mode: "insensitive" } },
                    { lastName: { contains: filter.search, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.wallet.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { updatedAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.wallet.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        userId: r.userId,
        userName: `${r.user.firstName} ${r.user.lastName}`.trim(),
        userEmail: r.user.email,
        main: r.balance,
        locked: r.lockedBalance,
        bonus: r.bonusBalance,
        updatedAt: r.updatedAt,
      })),
      total,
    };
  }
}
