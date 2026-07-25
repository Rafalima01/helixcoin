import type { WalletAccount } from "@prisma/client";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/server/errors";
import { eventBus } from "@/server/events";
import { AuditService } from "@/server/audit";
import { walletAccountCode } from "@/modules/ledger/constants/ledger.constants";
import { LEDGER_EVENTS } from "@/modules/ledger/events/ledger.events";
import {
  SYSTEM_ACCOUNT_FOR_TYPE,
  DEFAULT_ACCOUNT,
} from "@/modules/wallet/constants/wallet.constants";
import { WALLET_EVENTS } from "@/modules/wallet/events/wallet.events";
import { IdempotencyConflictError } from "@/modules/wallet/errors";
import type {
  IWalletRepository,
  LockedWalletCtx,
  TransactionListFilter,
  WalletListFilter,
} from "@/modules/wallet/interfaces/wallet-repository.interface";
import type {
  WalletBalances,
  WalletTransaction,
  WalletMutationResult,
  WalletActor,
  WalletAdminSummary,
  TransactionType,
} from "@/modules/wallet/entities/wallet.entity";

export interface MoveInput {
  userId: string;
  amountCents: number;
  type: TransactionType;
  account?: WalletAccount;
  origin: string;
  originId?: string | null;
  description?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown> | null;
  actor: WalletActor;
}

/** Same shape as MoveInput — lock()/unlock() move between a wallet's own MAIN<->LOCKED buckets rather than against a system account, but the caller-facing input is identical. */
export type LockInput = MoveInput;

export interface TransferInput {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  origin: string;
  originId?: string | null;
  description?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown> | null;
  actor: WalletActor;
}

export interface RefundInput {
  userId: string;
  amountCents: number;
  origin: string;
  originId?: string | null;
  description?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown> | null;
  actor: WalletActor;
}

export interface AdjustInput {
  /** Signed: positive credits, negative debits. */
  amountCents: number;
  userId: string;
  account?: WalletAccount;
  reason: string;
  observation: string;
  idempotencyKey: string;
  actor: WalletActor;
}

export interface ReverseInput {
  originalTransactionId: string;
  reason: string;
  idempotencyKey?: string;
  actor: WalletActor;
}

export interface InitiateDepositInput {
  userId: string;
  amountCents: number;
  method?: string | null;
  pixKey?: string | null;
  idempotencyKey: string;
}

function bucketKey(account: WalletAccount): "main" | "locked" | "bonus" {
  switch (account) {
    case "MAIN":
      return "main";
    case "LOCKED":
      return "locked";
    case "BONUS":
      return "bonus";
  }
}

interface RawMoveResult {
  transaction: WalletTransaction;
  before: WalletBalances;
  after: WalletBalances;
}

/**
 * The platform's sole writer of Wallet balances. Every method here is
 * transactional (via IWalletRepository.withLockedWallet/withLockedWalletPair
 * — a Postgres `SELECT ... FOR UPDATE` row lock in the real implementation)
 * and idempotency-key-guarded. credit()/debit() are the two primitives that
 * actually move a wallet balance against a system ledger account;
 * lock()/unlock()/transfer() move money between accounts directly;
 * refund()/adjust()/reverse() are composed on top of credit()/debit() so
 * there is exactly one real "move a balance + write matching ledger pair"
 * code path in the whole module.
 */
export class WalletService {
  constructor(private readonly wallets: IWalletRepository) {}

  async getBalance(userId: string): Promise<WalletBalances> {
    return this.wallets.getOrCreateWallet(userId);
  }

  async validateFunds(
    userId: string,
    amountCents: number,
    account: WalletAccount = "MAIN"
  ): Promise<boolean> {
    const balances = await this.wallets.getOrCreateWallet(userId);
    return balances[bucketKey(account)] >= amountCents;
  }

  async getTransactionById(id: string): Promise<WalletTransaction | null> {
    return this.wallets.getTransactionById(id);
  }

  async listTransactions(
    filter: TransactionListFilter
  ): Promise<{ items: WalletTransaction[]; total: number }> {
    return this.wallets.listTransactions(filter);
  }

  async listWalletsAdmin(
    filter: WalletListFilter
  ): Promise<{ items: WalletAdminSummary[]; total: number }> {
    return this.wallets.listWalletsAdmin(filter);
  }

  async credit(input: MoveInput): Promise<WalletMutationResult> {
    const result = await this.moveAgainstSystemAccount(input, "credit");
    if (!result.idempotent) this.publish(WALLET_EVENTS.credited, result.transaction);
    return result;
  }

  async debit(input: MoveInput): Promise<WalletMutationResult> {
    const result = await this.moveAgainstSystemAccount(input, "debit");
    if (!result.idempotent) this.publish(WALLET_EVENTS.debited, result.transaction);
    return result;
  }

  async refund(input: RefundInput): Promise<WalletMutationResult> {
    const result = await this.moveAgainstSystemAccount(
      {
        userId: input.userId,
        amountCents: input.amountCents,
        type: "BET_REFUND",
        account: "MAIN",
        origin: input.origin,
        originId: input.originId,
        description: input.description,
        idempotencyKey: input.idempotencyKey,
        metadata: input.metadata,
        actor: input.actor,
      },
      "credit"
    );
    if (!result.idempotent) this.publish(WALLET_EVENTS.refunded, result.transaction);
    return result;
  }

  async adjust(input: AdjustInput): Promise<WalletMutationResult> {
    if (!input.reason.trim() || !input.observation.trim()) {
      throw new ValidationError("Motivo e observação são obrigatórios para ajuste manual");
    }

    const direction = input.amountCents >= 0 ? "credit" : "debit";
    const result = await this.moveAgainstSystemAccount(
      {
        userId: input.userId,
        amountCents: Math.abs(input.amountCents),
        type: "ADJUSTMENT",
        account: input.account ?? DEFAULT_ACCOUNT,
        origin: "admin",
        originId: input.actor.actorId,
        description: `${input.reason} — ${input.observation}`,
        idempotencyKey: input.idempotencyKey,
        metadata: {
          reason: input.reason,
          observation: input.observation,
          adminId: input.actor.actorId,
        },
        actor: input.actor,
      },
      direction
    );

    if (!result.idempotent) {
      await AuditService.record({
        actorId: input.actor.actorId,
        actorType: input.actor.actorType,
        actorRole: input.actor.actorRole ?? null,
        action: "wallet.adjust",
        entityType: "Wallet",
        entityId: input.userId,
        before: result.balanceBefore,
        after: result.balanceAfter,
        ip: input.actor.ip ?? null,
        userAgent: input.actor.userAgent ?? null,
      });
      this.publish(WALLET_EVENTS.adjusted, result.transaction);
    }

    return result;
  }

  async reverse(input: ReverseInput): Promise<WalletMutationResult> {
    const original = await this.wallets.getTransactionById(input.originalTransactionId);
    if (!original) throw new NotFoundError("Transação");
    if (original.type === "REVERSAL")
      throw new BusinessRuleError("Não é possível reverter uma reversão");

    // Defaulting to a key derived from the original id (rather than requiring the caller to invent one) makes "reverse the same transaction twice" naturally a no-op via the same idempotency mechanism every other method uses.
    const idempotencyKey = input.idempotencyKey ?? `reverse:${original.id}`;

    const wasCredit = (original.balanceAfter ?? 0) > (original.balanceBefore ?? 0);
    const direction = wasCredit ? "debit" : "credit";

    const result = await this.moveAgainstSystemAccount(
      {
        userId: original.userId,
        amountCents: original.amount,
        type: "REVERSAL",
        account: original.account,
        origin: "wallet-reverse",
        originId: original.id,
        description: input.reason,
        idempotencyKey,
        metadata: { originalTransactionId: original.id },
        actor: input.actor,
      },
      direction
    );

    return result;
  }

  async lock(input: LockInput): Promise<WalletMutationResult> {
    const existing = await this.wallets.findTransactionByIdempotencyKey(input.idempotencyKey);
    if (existing) return this.idempotentResult(existing);

    const result = await this.withRaceRecovery(input.idempotencyKey, () =>
      this.wallets.withLockedWallet(input.userId, async (ctx) => {
        const before = ctx.balances;
        if (before.main < input.amountCents)
          throw new BusinessRuleError("Saldo insuficiente para bloqueio");
        const after = await ctx.applyDelta({ main: -input.amountCents, locked: input.amountCents });
        return this.writeMovement(
          ctx,
          input,
          before,
          after,
          "LOCKED",
          before.locked,
          after.locked,
          {
            debitAccount: walletAccountCode(input.userId, "MAIN"),
            creditAccount: walletAccountCode(input.userId, "LOCKED"),
          }
        );
      })
    );

    if (!result.idempotent) this.publish(WALLET_EVENTS.locked, result.transaction);
    return result;
  }

  async unlock(input: LockInput): Promise<WalletMutationResult> {
    const existing = await this.wallets.findTransactionByIdempotencyKey(input.idempotencyKey);
    if (existing) return this.idempotentResult(existing);

    const result = await this.withRaceRecovery(input.idempotencyKey, () =>
      this.wallets.withLockedWallet(input.userId, async (ctx) => {
        const before = ctx.balances;
        if (before.locked < input.amountCents)
          throw new BusinessRuleError("Saldo bloqueado insuficiente");
        const after = await ctx.applyDelta({ main: input.amountCents, locked: -input.amountCents });
        return this.writeMovement(ctx, input, before, after, "MAIN", before.main, after.main, {
          debitAccount: walletAccountCode(input.userId, "LOCKED"),
          creditAccount: walletAccountCode(input.userId, "MAIN"),
        });
      })
    );

    if (!result.idempotent) this.publish(WALLET_EVENTS.unlocked, result.transaction);
    return result;
  }

  async transfer(
    input: TransferInput
  ): Promise<{ debit: WalletMutationResult; credit: WalletMutationResult }> {
    const debitKey = `${input.idempotencyKey}:debit`;
    const creditKey = `${input.idempotencyKey}:credit`;

    const existingDebit = await this.wallets.findTransactionByIdempotencyKey(debitKey);
    if (existingDebit) {
      const existingCredit = await this.wallets.findTransactionByIdempotencyKey(creditKey);
      if (existingCredit) {
        return {
          debit: await this.idempotentResult(existingDebit),
          credit: await this.idempotentResult(existingCredit),
        };
      }
    }

    try {
      const { debit, credit } = await this.wallets.withLockedWalletPair(
        input.fromUserId,
        input.toUserId,
        async (fromCtx, toCtx) => {
          const fromBefore = fromCtx.balances;
          const toBefore = toCtx.balances;
          if (fromBefore.main < input.amountCents)
            throw new BusinessRuleError("Saldo insuficiente para transferência");

          const fromAfter = await fromCtx.applyDelta({ main: -input.amountCents });
          const toAfter = await toCtx.applyDelta({ main: input.amountCents });

          const ledgerId = crypto.randomUUID();
          const debitTxId = crypto.randomUUID();
          const creditTxId = crypto.randomUUID();

          // One shared LedgerEntry for both sides of the transfer — see schema.prisma's LedgerEntry doc comment.
          await fromCtx.createLedgerEntry({
            id: ledgerId,
            transactionId: debitTxId,
            debitAccount: walletAccountCode(input.fromUserId, "MAIN"),
            creditAccount: walletAccountCode(input.toUserId, "MAIN"),
            amount: input.amountCents,
            reference: input.originId ?? undefined,
            referenceType: input.origin,
            description: input.description ?? undefined,
          });

          const debitTx = await fromCtx.createWalletTransaction({
            id: debitTxId,
            walletId: fromBefore.walletId,
            userId: input.fromUserId,
            ledgerId,
            type: "TRANSFER",
            account: "MAIN",
            amount: input.amountCents,
            balanceBefore: fromBefore.main,
            balanceAfter: fromAfter.main,
            origin: input.origin,
            originId: input.originId,
            description: input.description,
            idempotencyKey: debitKey,
            metadata: input.metadata,
          });

          const creditTx = await toCtx.createWalletTransaction({
            id: creditTxId,
            walletId: toBefore.walletId,
            userId: input.toUserId,
            ledgerId,
            type: "TRANSFER",
            account: "MAIN",
            amount: input.amountCents,
            balanceBefore: toBefore.main,
            balanceAfter: toAfter.main,
            origin: input.origin,
            originId: input.originId,
            description: input.description,
            idempotencyKey: creditKey,
            metadata: input.metadata,
          });

          return {
            debit: { transaction: debitTx, before: fromBefore, after: fromAfter },
            credit: { transaction: creditTx, before: toBefore, after: toAfter },
          };
        }
      );

      this.publish(WALLET_EVENTS.debited, debit.transaction);
      this.publish(WALLET_EVENTS.credited, credit.transaction);

      return { debit: this.toResult(debit), credit: this.toResult(credit) };
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        const winnerDebit = await this.wallets.findTransactionByIdempotencyKey(debitKey);
        const winnerCredit = await this.wallets.findTransactionByIdempotencyKey(creditKey);
        if (winnerDebit && winnerCredit) {
          return {
            debit: await this.idempotentResult(winnerDebit),
            credit: await this.idempotentResult(winnerCredit),
          };
        }
      }
      throw err;
    }
  }

  /** Registers deposit intent only — zero balance effect, zero ledger entry (nothing has actually moved yet), still idempotency-guarded. */
  async initiateDeposit(input: InitiateDepositInput): Promise<WalletTransaction> {
    const existing = await this.wallets.findTransactionByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    try {
      return await this.wallets.withLockedWallet(input.userId, (ctx) =>
        ctx.createWalletTransaction({
          id: crypto.randomUUID(),
          walletId: ctx.balances.walletId,
          userId: input.userId,
          ledgerId: null,
          type: "DEPOSIT_PENDING",
          account: "MAIN",
          amount: input.amountCents,
          balanceBefore: null,
          balanceAfter: null,
          origin: "wallet-api",
          originId: null,
          description: null,
          idempotencyKey: input.idempotencyKey,
          metadata: { method: input.method ?? "PIX", pixKey: input.pixKey ?? null },
        })
      );
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        const winner = await this.wallets.findTransactionByIdempotencyKey(err.idempotencyKey);
        if (winner) return winner;
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------- shared

  private async moveAgainstSystemAccount(
    input: MoveInput,
    direction: "credit" | "debit"
  ): Promise<WalletMutationResult> {
    const existing = await this.wallets.findTransactionByIdempotencyKey(input.idempotencyKey);
    if (existing) return this.idempotentResult(existing);

    const account = input.account ?? DEFAULT_ACCOUNT;
    const bucket = bucketKey(account);
    const walletAccount = walletAccountCode(input.userId, account);
    const systemAccount = SYSTEM_ACCOUNT_FOR_TYPE[input.type];

    return this.withRaceRecovery(input.idempotencyKey, () =>
      this.wallets.withLockedWallet(input.userId, async (ctx) => {
        const before = ctx.balances;
        if (direction === "debit" && before[bucket] < input.amountCents) {
          throw new BusinessRuleError("Saldo insuficiente");
        }

        const signedDelta = direction === "credit" ? input.amountCents : -input.amountCents;
        const after = await ctx.applyDelta({ [bucket]: signedDelta });

        return this.writeMovement(
          ctx,
          input,
          before,
          after,
          account,
          before[bucket],
          after[bucket],
          {
            debitAccount: direction === "credit" ? systemAccount : walletAccount,
            creditAccount: direction === "credit" ? walletAccount : systemAccount,
          }
        );
      })
    );
  }

  /** Common "write the ledger pair, then the wallet transaction row" tail shared by every mutating method. */
  private async writeMovement(
    ctx: LockedWalletCtx,
    input: {
      userId: string;
      amountCents: number;
      type: TransactionType;
      origin: string;
      originId?: string | null;
      description?: string | null;
      idempotencyKey: string;
      metadata?: Record<string, unknown> | null;
    },
    before: WalletBalances,
    after: WalletBalances,
    account: WalletAccount,
    bucketBefore: number,
    bucketAfter: number,
    pair: { debitAccount: string; creditAccount: string }
  ): Promise<RawMoveResult> {
    const txId = crypto.randomUUID();
    const ledgerId = crypto.randomUUID();

    await ctx.createLedgerEntry({
      id: ledgerId,
      transactionId: txId,
      debitAccount: pair.debitAccount,
      creditAccount: pair.creditAccount,
      amount: input.amountCents,
      reference: input.originId ?? undefined,
      referenceType: input.origin,
      description: input.description ?? undefined,
    });

    const transaction = await ctx.createWalletTransaction({
      id: txId,
      walletId: before.walletId,
      userId: input.userId,
      ledgerId,
      type: input.type,
      account,
      amount: input.amountCents,
      balanceBefore: bucketBefore,
      balanceAfter: bucketAfter,
      origin: input.origin,
      originId: input.originId,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    });

    return { transaction, before, after };
  }

  /**
   * Runs a locked-wallet mutation, recovering gracefully if it lost an
   * idempotency-key race (see IdempotencyConflictError) — a concurrent
   * identical request committed first, so this returns that one instead of
   * propagating an error.
   */
  private async withRaceRecovery(
    idempotencyKey: string,
    run: () => Promise<RawMoveResult>
  ): Promise<WalletMutationResult> {
    try {
      return this.toResult(await run());
    } catch (err) {
      if (err instanceof IdempotencyConflictError) {
        const winner = await this.wallets.findTransactionByIdempotencyKey(idempotencyKey);
        if (winner) return this.idempotentResult(winner);
      }
      throw err;
    }
  }

  private toResult(raw: RawMoveResult): WalletMutationResult {
    return {
      transaction: raw.transaction,
      balanceBefore: raw.before,
      balanceAfter: raw.after,
      idempotent: false,
    };
  }

  private async idempotentResult(transaction: WalletTransaction): Promise<WalletMutationResult> {
    const balances = await this.wallets.getOrCreateWallet(transaction.userId);
    return { transaction, balanceBefore: balances, balanceAfter: balances, idempotent: true };
  }

  private publish(eventName: string, tx: WalletTransaction): void {
    eventBus.publish(eventName, {
      transactionId: tx.id,
      userId: tx.userId,
      type: tx.type,
      account: tx.account,
      amount: tx.amount,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      origin: tx.origin,
      originId: tx.originId,
    });
    eventBus.publish(WALLET_EVENTS.transactionCreated, {
      transactionId: tx.id,
      userId: tx.userId,
      type: tx.type,
    });
    if (tx.ledgerId) {
      eventBus.publish(LEDGER_EVENTS.created, { ledgerEntryId: tx.ledgerId, transactionId: tx.id });
    }
  }
}
