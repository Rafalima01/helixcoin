import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

import { WalletService } from "@/modules/wallet/services/wallet.service";
import { InMemoryWalletRepository } from "@/modules/wallet/repositories/wallet.in-memory-repository";
import { AuditService } from "@/server/audit";
import { IdempotencyConflictError } from "@/modules/wallet/errors";
import type {
  IWalletRepository,
  LockedWalletCtx,
  CreateWalletTransactionInput,
  CreateLedgerEntryInput,
  TransactionListFilter,
  WalletListFilter,
} from "@/modules/wallet/interfaces/wallet-repository.interface";
import type { WalletActor, WalletBalances, WalletTransaction } from "@/modules/wallet/entities/wallet.entity";
import type { LedgerEntry } from "@/modules/ledger/entities/ledger-entry.entity";

const USER_ID = "user-1";
const SYSTEM_ACTOR: WalletActor = { actorId: null, actorType: "SYSTEM" };
const ADMIN_ACTOR: WalletActor = { actorId: "admin-1", actorType: "ADMIN" };

/**
 * A deliberately UNSERIALIZED repository stub — unlike InMemoryWalletRepository,
 * `withLockedWallet` here runs the callback immediately with no per-wallet
 * mutex, so two "concurrent" calls can both pass WalletService's
 * findTransactionByIdempotencyKey pre-check before either has written.
 * createWalletTransaction() throws IdempotencyConflictError on whichever
 * write loses that race — the same signal PrismaWalletRepository derives
 * from a real Postgres unique-constraint violation (P2002). Exists only to
 * exercise WalletService's recovery path deterministically without relying
 * on real timing.
 */
class RacyWalletRepositoryStub implements IWalletRepository {
  private balance: WalletBalances = {
    userId: USER_ID,
    walletId: "wallet-1",
    main: 0,
    locked: 0,
    bonus: 0,
    updatedAt: new Date(),
  };
  private readonly transactions: WalletTransaction[] = [];

  setBalance(main: number): void {
    this.balance = { ...this.balance, main };
  }

  async getOrCreateWallet(): Promise<WalletBalances> {
    return this.balance;
  }

  async findTransactionByIdempotencyKey(key: string): Promise<WalletTransaction | null> {
    return this.transactions.find((t) => t.idempotencyKey === key) ?? null;
  }

  async getTransactionById(id: string): Promise<WalletTransaction | null> {
    return this.transactions.find((t) => t.id === id) ?? null;
  }

  async listTransactions(_filter: TransactionListFilter) {
    return { items: this.transactions, total: this.transactions.length };
  }

  async listWalletsAdmin(_filter: WalletListFilter) {
    return { items: [], total: 0 };
  }

  async withLockedWallet<T>(_userId: string, fn: (ctx: LockedWalletCtx) => Promise<T>): Promise<T> {
    return fn(this.buildCtx());
  }

  async withLockedWalletPair<T>(
    _a: string,
    _b: string,
    fn: (ctxA: LockedWalletCtx, ctxB: LockedWalletCtx) => Promise<T>
  ): Promise<T> {
    return fn(this.buildCtx(), this.buildCtx());
  }

  private buildCtx(): LockedWalletCtx {
    return {
      balances: this.balance,
      applyDelta: async (delta) => {
        this.balance = {
          ...this.balance,
          main: this.balance.main + (delta.main ?? 0),
          locked: this.balance.locked + (delta.locked ?? 0),
          bonus: this.balance.bonus + (delta.bonus ?? 0),
        };
        return this.balance;
      },
      createLedgerEntry: async (input: CreateLedgerEntryInput): Promise<LedgerEntry> => ({
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
      }),
      createWalletTransaction: async (input: CreateWalletTransactionInput) => {
        if (input.idempotencyKey && this.transactions.some((t) => t.idempotencyKey === input.idempotencyKey)) {
          throw new IdempotencyConflictError(input.idempotencyKey);
        }
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
        this.transactions.push(tx);
        return tx;
      },
    };
  }
}

describe("WalletService idempotency", () => {
  it("credit() called twice with the same idempotencyKey moves the balance exactly once", async () => {
    const wallets = new InMemoryWalletRepository();
    const service = new WalletService(wallets);
    const idempotencyKey = "dup-key-credit";

    const first = await service.credit({
      userId: USER_ID,
      amountCents: 1000,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey,
      actor: SYSTEM_ACTOR,
    });
    const second = await service.credit({
      userId: USER_ID,
      amountCents: 1000,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey,
      actor: SYSTEM_ACTOR,
    });

    expect(second.transaction.id).toBe(first.transaction.id);
    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    const balance = await service.getBalance(USER_ID);
    expect(balance.main).toBe(1000);
  });

  it("adjust() replayed with the same key never double-adjusts or double-audits", async () => {
    vi.mocked(AuditService.record).mockClear();
    const wallets = new InMemoryWalletRepository();
    const service = new WalletService(wallets);
    const idempotencyKey = "dup-key-adjust";
    const input = {
      userId: USER_ID,
      amountCents: 500,
      reason: "correção",
      observation: "duplicada de propósito",
      idempotencyKey,
      actor: ADMIN_ACTOR,
    };

    await service.adjust(input);
    await service.adjust(input);

    const balance = await service.getBalance(USER_ID);
    expect(balance.main).toBe(500);
    expect(AuditService.record).toHaveBeenCalledTimes(1);
  });

  it("reverse() replayed on the same original transaction without an explicit key is a no-op the second time", async () => {
    const wallets = new InMemoryWalletRepository();
    const service = new WalletService(wallets);
    const original = await service.credit({
      userId: USER_ID,
      amountCents: 700,
      type: "DEPOSIT",
      origin: "test",
      idempotencyKey: "original-for-reverse",
      actor: SYSTEM_ACTOR,
    });

    const first = await service.reverse({ originalTransactionId: original.transaction.id, reason: "chargeback", actor: ADMIN_ACTOR });
    const second = await service.reverse({ originalTransactionId: original.transaction.id, reason: "chargeback", actor: ADMIN_ACTOR });

    expect(second.transaction.id).toBe(first.transaction.id);
    const balance = await service.getBalance(USER_ID);
    expect(balance.main).toBe(0);
  });

  it("recovers from a simulated write race (a second write losing an idempotency-key conflict returns the winner instead of erroring)", async () => {
    const stub = new RacyWalletRepositoryStub();
    stub.setBalance(1000);
    const service = new WalletService(stub);
    const idempotencyKey = "race-key-1";

    const [first, second] = await Promise.all([
      service.debit({
        userId: USER_ID,
        amountCents: 200,
        type: "BET",
        origin: "test",
        idempotencyKey,
        actor: SYSTEM_ACTOR,
      }),
      service.debit({
        userId: USER_ID,
        amountCents: 200,
        type: "BET",
        origin: "test",
        idempotencyKey,
        actor: SYSTEM_ACTOR,
      }),
    ]);

    expect(first.transaction.id).toBe(second.transaction.id);
    // Exactly one of the two calls actually performed the write; the other recovered.
    expect([first.idempotent, second.idempotent].filter(Boolean)).toHaveLength(1);
  });
});
