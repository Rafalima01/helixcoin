import type { Role } from "@prisma/client";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/server/errors";
import { eventBus } from "@/server/events";
import { AuditService } from "@/server/audit";
import { NotificationService, NOTIFICATION_TYPES } from "@/server/notifications";
import { formatCurrency } from "@/lib/utils";
import { CacheService } from "@/server/cache/cache.service";
import { decrypt } from "@/server/security/crypto-utils";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import type { WalletActor } from "@/modules/wallet/entities/wallet.entity";
// Reused, not reimplemented — same masking convention as
// src/modules/payments/services/payment.service.ts's listWithdrawsAdmin.
// This is the only src/modules/payments import in this module; it's a pure
// utility function with no gateway/DB coupling.
import { maskPixKey } from "@/modules/payments/constants/payments.constants";
import {
  COMMERCIAL_WITHDRAW_IDEMPOTENCY_KEYS,
  commercialWithdrawCreateLockKey,
  COMMERCIAL_WITHDRAW_CREATE_LOCK_TTL_MS,
} from "@/modules/commercial-withdrawals/constants/commercial-withdrawals.constants";
import { COMMERCIAL_WITHDRAW_EVENTS } from "@/modules/commercial-withdrawals/events/commercial-withdraw.events";
import type { ICommercialWithdrawRepository, CommercialWithdrawListFilter } from "@/modules/commercial-withdrawals/interfaces/commercial-withdraw-repository.interface";
import type { IPixKeyRepository } from "@/modules/commercial-withdrawals/interfaces/pix-key-repository.interface";
import type {
  CommercialWithdraw,
  CommercialWithdrawAdminRow,
  CommercialWithdrawPayeeRole,
} from "@/modules/commercial-withdrawals/entities/commercial-withdraw.entity";

const SYSTEM_ACTOR: WalletActor = { actorId: null, actorType: "SYSTEM" };

export interface RequestCommercialWithdrawInput {
  userId: string;
  payeeRole: CommercialWithdrawPayeeRole;
  amountCents: number;
  pixKeyId: string;
  actor: WalletActor;
}

export interface DecideCommercialWithdrawInput {
  id: string;
  action: "APPROVE" | "REJECT";
  rejectionReason?: string;
  actor: { id: string; role: Role };
  meta: { ip: string | null; userAgent: string | null };
}

/**
 * The commercial-withdrawal engine — an Affiliate/Manager cashing out their
 * commission balance. Always admin-approved, never automatic (no gateway
 * anywhere in this module, unlike src/modules/payments' Withdraw). Every
 * balance movement still runs exclusively through WalletService (lock/
 * debit/unlock); this class never touches a Wallet balance directly.
 */
export class CommercialWithdrawService {
  constructor(
    private readonly commercialWithdraws: ICommercialWithdrawRepository,
    private readonly pixKeys: IPixKeyRepository,
    private readonly walletService: WalletService
  ) {}

  /** A6-style protection (see payments' requestWithdraw doc comment) — a double-click/retry can never create two real commercial withdrawals for the same user at once. */
  async request(input: RequestCommercialWithdrawInput): Promise<CommercialWithdraw> {
    if (input.amountCents <= 0) throw new ValidationError("Valor deve ser positivo");

    const result = await CacheService.withLock(
      commercialWithdrawCreateLockKey(input.userId),
      COMMERCIAL_WITHDRAW_CREATE_LOCK_TTL_MS,
      () => this.requestLocked(input)
    );
    if (result === null) {
      throw new BusinessRuleError(
        "Já existe uma solicitação de saque em andamento — aguarde alguns segundos e tente novamente."
      );
    }
    return result;
  }

  private async requestLocked(input: RequestCommercialWithdrawInput): Promise<CommercialWithdraw> {
    const pixKey = await this.pixKeys.findById(input.pixKeyId);
    if (!pixKey || pixKey.userId !== input.userId) throw new NotFoundError("Chave PIX");

    const withdrawId = crypto.randomUUID();

    const locked = await this.walletService.lock({
      userId: input.userId,
      amountCents: input.amountCents,
      type: "WITHDRAW_PENDING",
      origin: "commercial",
      originId: withdrawId,
      idempotencyKey: COMMERCIAL_WITHDRAW_IDEMPOTENCY_KEYS.lock(withdrawId),
      metadata: { payeeRole: input.payeeRole, pixKeyId: input.pixKeyId },
      actor: input.actor,
    });

    const created = await this.commercialWithdraws.create({
      id: withdrawId,
      userId: input.userId,
      payeeRole: input.payeeRole,
      amountCents: input.amountCents,
      pixKeyId: pixKey.id,
      pixKeyType: pixKey.type,
      pixKeyEncrypted: pixKey.keyEncrypted,
      holderCpf: pixKey.holderCpf,
      lockWalletTransactionId: locked.transaction.id,
    });

    eventBus.publish(COMMERCIAL_WITHDRAW_EVENTS.requested, {
      id: created.id,
      userId: input.userId,
      amountCents: input.amountCents,
      payeeRole: input.payeeRole,
    });

    return created;
  }

  /**
   * Admin approve/reject — the single most safety-critical method in this
   * module. The invariant that must hold under ANY interleaving, including
   * two truly-simultaneous decide() calls on the SAME id (e.g. one admin
   * clicking Approve while another clicks Reject on the same row): exactly
   * one of {approve, reject} ever completes, exactly one wallet movement
   * happens, and the persisted status always matches the wallet movement
   * that actually occurred.
   *
   * ORDERING DECISION — CAS FIRST, wallet movement SECOND, deliberately
   * different from the pseudocode sketch this method was speced from (which
   * called WalletService.debit/unlock BEFORE the CAS, reasoning that
   * WalletService's own per-idempotency-key replay-safety made that order
   * safe). That reasoning does NOT hold here, and this is why:
   *
   *   APPROVE and REJECT use two DIFFERENT idempotency keys
   *   (`commercial-withdraw:{id}:approve` vs `...:unlock-reject`), so
   *   WalletService's idempotency guard — which only short-circuits a
   *   REPLAYED call using the SAME key — does nothing to stop one of each
   *   from both going through. Concretely, if APPROVE's debit(LOCKED) runs
   *   first and drains this withdraw's amount out of the user's LOCKED
   *   bucket, a concurrent REJECT's unlock() a moment later checks
   *   `before.locked < amountCents` against whatever is LEFT in that
   *   shared bucket — if the user happens to have ANOTHER pending
   *   commercial withdrawal (or anything else parked in LOCKED) covering
   *   the shortfall, REJECT's unlock() can succeed anyway, incorrectly
   *   moving funds that belong to a different request into MAIN. The
   *   wallet is now wrong (double-counted), even though the CAS on the
   *   CommercialWithdraw row itself would correctly let only one of the
   *   two decide() calls win the status transition. Status and wallet
   *   would disagree, and the erroneous wallet movement is not
   *   recoverable from the status alone.
   *
   * Doing the CAS FIRST closes this hole completely: `decide()` below
   * (an `updateMany({ where: { id, status: "PENDING" } })` + `count === 1`
   * check) is the ONLY gate, and it is atomic at the database level
   * regardless of idempotency keys, shared buckets, or which action got
   * there first. Only the call that wins the CAS ever reaches the
   * WalletService call below — so at most one wallet movement can ever
   * happen per withdraw id, full stop. The loser throws immediately,
   * before touching the wallet at all.
   *
   * Trade-off accepted: there's a small window, after the CAS commits and
   * before the WalletService call below completes, where the persisted
   * status (APPROVED/REJECTED) is momentarily ahead of the actual wallet
   * movement. If the process crashed in exactly that window, the row would
   * be stuck "decided" with its funds still sitting in LOCKED and no
   * automatic retry (a fresh decide() call on the same id would now fail
   * the CAS, since the status is no longer PENDING). This is the same
   * class of residual risk src/modules/payments/services/payment.service.ts's
   * settle() already accepts for withdraw.approved/withdraw.rejected
   * (debit/unlock there is likewise followed by a separate, non-atomic
   * `this.withdraws.update(...)` for the status/settle-transaction write) —
   * not a new risk this module introduces, and a strictly smaller,
   * strictly safer window than the double-movement bug the alternative
   * ordering would have allowed under concurrent opposite decisions.
   */
  async decide(input: DecideCommercialWithdrawInput): Promise<CommercialWithdraw> {
    const withdraw = await this.commercialWithdraws.findById(input.id);
    if (!withdraw) throw new NotFoundError("Saque comercial");
    if (input.action === "REJECT" && !input.rejectionReason?.trim()) {
      throw new ValidationError("Motivo da rejeição é obrigatório");
    }

    const toStatus = input.action === "APPROVE" ? "APPROVED" : "REJECTED";

    // The CAS gate — see doc comment above for why this MUST run before any
    // WalletService call.
    const decided = await this.commercialWithdraws.decide(withdraw.id, "PENDING", toStatus, {
      decidedByUserId: input.actor.id,
      processedAt: new Date(),
      ...(input.action === "REJECT" ? { rejectionReason: input.rejectionReason } : {}),
    });
    if (!decided) throw new BusinessRuleError("Saque já foi processado");

    // From here on this call is the sole, guaranteed-once owner of this
    // withdraw's wallet movement.
    const settled =
      input.action === "APPROVE"
        ? await this.walletService.debit({
            userId: withdraw.userId,
            amountCents: withdraw.amountCents,
            type: "WITHDRAW_APPROVED",
            account: "LOCKED",
            origin: "commercial",
            originId: withdraw.id,
            idempotencyKey: COMMERCIAL_WITHDRAW_IDEMPOTENCY_KEYS.approve(withdraw.id),
            actor: SYSTEM_ACTOR,
          })
        : await this.walletService.unlock({
            userId: withdraw.userId,
            amountCents: withdraw.amountCents,
            type: "WITHDRAW_REJECTED",
            origin: "commercial",
            originId: withdraw.id,
            idempotencyKey: COMMERCIAL_WITHDRAW_IDEMPOTENCY_KEYS.unlockReject(withdraw.id),
            actor: SYSTEM_ACTOR,
          });

    await this.commercialWithdraws.attachSettleTransaction(withdraw.id, settled.transaction.id);

    await AuditService.record({
      actorId: input.actor.id,
      actorType: "ADMIN",
      actorRole: input.actor.role,
      action: input.action === "APPROVE" ? "commercial_withdraw.approve" : "commercial_withdraw.reject",
      entityType: "CommercialWithdraw",
      entityId: withdraw.id,
      before: { status: "PENDING" },
      after: { status: toStatus, amountCents: withdraw.amountCents },
      ip: input.meta.ip,
      userAgent: input.meta.userAgent,
    });

    await NotificationService.notify({
      userId: withdraw.userId,
      type: input.action === "APPROVE" ? NOTIFICATION_TYPES.withdrawApproved : NOTIFICATION_TYPES.withdrawRejected,
      title: input.action === "APPROVE" ? "Saque aprovado" : "Saque rejeitado",
      message:
        input.action === "APPROVE"
          ? `Seu saque de ${formatCurrency(withdraw.amountCents / 100)} foi aprovado.`
          : `Seu saque de ${formatCurrency(withdraw.amountCents / 100)} foi rejeitado. Motivo: ${input.rejectionReason}`,
    });

    eventBus.publish(
      input.action === "APPROVE" ? COMMERCIAL_WITHDRAW_EVENTS.approved : COMMERCIAL_WITHDRAW_EVENTS.rejected,
      { id: withdraw.id, userId: withdraw.userId, amountCents: withdraw.amountCents, payeeRole: withdraw.payeeRole }
    );

    return { ...decided, settleWalletTransactionId: settled.transaction.id };
  }

  async listMine(userId: string, page: number, pageSize: number): Promise<{ items: CommercialWithdraw[]; total: number }> {
    return this.commercialWithdraws.listByUser(userId, page, pageSize);
  }

  async listAdmin(filter: CommercialWithdrawListFilter): Promise<{ items: { row: CommercialWithdrawAdminRow; pixKeyMasked: string }[]; total: number }> {
    const { items, total } = await this.commercialWithdraws.listAdmin(filter);
    return {
      items: items.map((row) => ({ row, pixKeyMasked: maskPixKey(decrypt(row.pixKeyEncrypted)) })),
      total,
    };
  }

  async getAdmin(id: string): Promise<{ withdraw: CommercialWithdrawAdminRow; pixKeyMasked: string }> {
    const row = await this.commercialWithdraws.findByIdAdmin(id);
    if (!row) throw new NotFoundError("Saque comercial");
    return { withdraw: row, pixKeyMasked: maskPixKey(decrypt(row.pixKeyEncrypted)) };
  }
}
