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
import type { LedgerEntry } from "@/modules/ledger/entities/ledger-entry.entity";
import { InMemoryLedgerRepository } from "@/modules/ledger/repositories/ledger.in-memory-repository";
import { IdempotencyConflictError } from "@/modules/wallet/errors";

/**
 * In-memory implementation — what tests inject instead of a real database.
 *
 * Two things it deliberately reproduces from the real Prisma repository:
 *  - Serializes withLockedWallet/withLockedWalletPair calls per userId via
 *    an in-process mutex chain — proves WalletService's per-wallet
 *    serialization logic (see tests/wallet.concurrency.test.ts), NOT
 *    Postgres's real `SELECT ... FOR UPDATE` row lock, which only
 *    PrismaWalletRepository exercises (verified manually against a live DB
 *    — same posture this session has used for every DB-dependent guarantee
 *    so far).
 *  - All-or-nothing commit: every write inside one withLockedWallet/
 *    withLockedWalletPair call is buffered and only applied to the real
 *    Maps/arrays if the callback resolves; a thrown error discards
 *    everything, mirroring a rolled-back `prisma.$transaction`. This is
 *    what makes tests/wallet.rollback.test.ts meaningful against this
 *    implementation.
 */
export class InMemoryWalletRepository implements IWalletRepository {
  private readonly wallets = new Map<string, WalletBalances>();
  private readonly transactions: WalletTransaction[] = [];
  private readonly locks = new Map<string, Promise<unknown>>();
  readonly ledger = new InMemoryLedgerRepository();

  /** Test-only convenience, mirrors the old InMemoryWalletLedger's setBalance helper. */
  setBalance(userId: string, balances: Partial<Pick<WalletBalances, "main" | "locked" | "bonus">>): void {
    const existing = this.getOrInit(userId);
    this.wallets.set(userId, { ...existing, ...balances });
  }

  private getOrInit(userId: string): WalletBalances {
    let w = this.wallets.get(userId);
    if (!w) {
      w = { userId, walletId: crypto.randomUUID(), main: 0, locked: 0, bonus: 0, updatedAt: new Date() };
      this.wallets.set(userId, w);
    }
    return w;
  }

  async getOrCreateWallet(userId: string): Promise<WalletBalances> {
    return { ...this.getOrInit(userId) };
  }

  /** Builds a ctx whose writes are buffered in `pendingTransactions`/`pendingLedgerEntries`/the returned balance holder — nothing touches the real Maps until the caller commits. */
  private buildCtx(
    userId: string,
    pendingBalance: { value: WalletBalances },
    pendingTransactions: WalletTransaction[],
    pendingLedgerEntries: (CreateLedgerEntryInput & { resolved: LedgerEntry })[]
  ): LockedWalletCtx {
    return {
      balances: { ...pendingBalance.value },
      applyDelta: async (delta: WalletBalanceDelta) => {
        pendingBalance.value = {
          ...pendingBalance.value,
          main: pendingBalance.value.main + (delta.main ?? 0),
          locked: pendingBalance.value.locked + (delta.locked ?? 0),
          bonus: pendingBalance.value.bonus + (delta.bonus ?? 0),
          updatedAt: new Date(),
        };
        return { ...pendingBalance.value };
      },
      createWalletTransaction: async (input: CreateWalletTransactionInput) => {
        const alreadyUsed =
          input.idempotencyKey &&
          (this.transactions.some((t) => t.idempotencyKey === input.idempotencyKey) ||
            pendingTransactions.some((t) => t.idempotencyKey === input.idempotencyKey));
        if (alreadyUsed) throw new IdempotencyConflictError(input.idempotencyKey!);

        const tx: WalletTransaction = {
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
          metadata: input.metadata ?? null,
          createdAt: new Date(),
        };
        pendingTransactions.push(tx);
        return tx;
      },
      createLedgerEntry: async (input: CreateLedgerEntryInput): Promise<LedgerEntry> => {
        const resolved: LedgerEntry = {
          id: input.id,
          transactionId: input.transactionId,
          debitAccount: input.debitAccount,
          creditAccount: input.creditAccount,
          amount: input.amount,
          currency: input.currency ?? "BRL",
          reference: input.reference ?? null,
          referenceType: input.referenceType ?? null,
          description: input.description ?? null,
          createdAt: new Date(),
        };
        pendingLedgerEntries.push({ ...input, resolved });
        return resolved;
      },
    };
  }

  /** Chains onto whatever's already queued for this userId, so concurrent calls against the SAME wallet serialize; different wallets run independently. */
  private async runLocked<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(userId) ?? Promise.resolve();
    const run = previous.then(fn, fn);
    // Track a settled-either-way marker so one failed operation never wedges the queue for later callers.
    this.locks.set(
      userId,
      run.then(
        () => undefined,
        () => undefined
      )
    );
    return run;
  }

  private async commit(
    userId: string,
    pendingBalance: { value: WalletBalances },
    pendingTransactions: WalletTransaction[],
    pendingLedgerEntries: (CreateLedgerEntryInput & { resolved: LedgerEntry })[]
  ): Promise<void> {
    // Ledger writes are the only step that can fail — done FIRST so a
    // failure here leaves the wallet balance and transaction rows
    // untouched, matching a rolled-back `prisma.$transaction` (nothing
    // partially applies).
    for (const entry of pendingLedgerEntries) await this.ledger.createEntry(entry);
    this.wallets.set(userId, pendingBalance.value);
    for (const tx of pendingTransactions) this.transactions.push(tx);
  }

  async withLockedWallet<T>(userId: string, fn: (ctx: LockedWalletCtx) => Promise<T>): Promise<T> {
    return this.runLocked(userId, async () => {
      const pendingBalance = { value: { ...this.getOrInit(userId) } };
      const pendingTransactions: WalletTransaction[] = [];
      const pendingLedgerEntries: (CreateLedgerEntryInput & { resolved: LedgerEntry })[] = [];

      const result = await fn(this.buildCtx(userId, pendingBalance, pendingTransactions, pendingLedgerEntries));
      await this.commit(userId, pendingBalance, pendingTransactions, pendingLedgerEntries);
      return result;
    });
  }

  async withLockedWalletPair<T>(
    userIdA: string,
    userIdB: string,
    fn: (ctxA: LockedWalletCtx, ctxB: LockedWalletCtx) => Promise<T>
  ): Promise<T> {
    const [first, second] = userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
    return this.runLocked(first, () =>
      this.runLocked(second, async () => {
        const pendingBalanceFirst = { value: { ...this.getOrInit(first) } };
        const pendingBalanceSecond = { value: { ...this.getOrInit(second) } };
        const pendingTransactions: WalletTransaction[] = [];
        const pendingLedgerEntries: (CreateLedgerEntryInput & { resolved: LedgerEntry })[] = [];

        const ctxFirst = this.buildCtx(first, pendingBalanceFirst, pendingTransactions, pendingLedgerEntries);
        const ctxSecond = this.buildCtx(second, pendingBalanceSecond, pendingTransactions, pendingLedgerEntries);
        const ctxA = first === userIdA ? ctxFirst : ctxSecond;
        const ctxB = first === userIdA ? ctxSecond : ctxFirst;

        const result = await fn(ctxA, ctxB);

        // Same atomic ordering as commit() — ledger writes (the only failable step) before either balance/transaction is touched.
        for (const entry of pendingLedgerEntries) await this.ledger.createEntry(entry);
        this.wallets.set(first, pendingBalanceFirst.value);
        this.wallets.set(second, pendingBalanceSecond.value);
        for (const tx of pendingTransactions) this.transactions.push(tx);

        return result;
      })
    );
  }

  async findTransactionByIdempotencyKey(key: string): Promise<WalletTransaction | null> {
    return this.transactions.find((t) => t.idempotencyKey === key) ?? null;
  }

  async getTransactionById(id: string): Promise<WalletTransaction | null> {
    return this.transactions.find((t) => t.id === id) ?? null;
  }

  async listTransactions(filter: TransactionListFilter): Promise<{ items: WalletTransaction[]; total: number }> {
    const all = this.transactions
      .filter((t) => !filter.userId || t.userId === filter.userId)
      .filter((t) => !filter.type || t.type === filter.type)
      .filter((t) => !filter.status || t.status === filter.status)
      .filter((t) => !filter.origin || t.origin === filter.origin)
      .filter((t) => !filter.from || t.createdAt >= filter.from)
      .filter((t) => !filter.to || t.createdAt <= filter.to)
      .filter((t) => filter.minAmount === undefined || t.amount >= filter.minAmount)
      .filter((t) => filter.maxAmount === undefined || t.amount <= filter.maxAmount)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const items = all.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize);
    return { items, total: all.length };
  }

  async listWalletsAdmin(filter: WalletListFilter): Promise<{ items: WalletAdminSummary[]; total: number }> {
    const all = [...this.wallets.values()]
      .filter((w) => !filter.search || w.userId.includes(filter.search))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const items = all.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize).map((w) => ({
      userId: w.userId,
      userName: w.userId,
      userEmail: w.userId,
      main: w.main,
      locked: w.locked,
      bonus: w.bonus,
      updatedAt: w.updatedAt,
    }));
    return { items, total: all.length };
  }
}
