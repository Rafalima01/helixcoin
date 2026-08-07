import type {
  CommercialWithdraw,
  CommercialWithdrawAdminRow,
  CommercialWithdrawPayeeRole,
  CommercialWithdrawStatus,
} from "@/modules/commercial-withdrawals/entities/commercial-withdraw.entity";
import type { PixKeyType } from "@/modules/commercial-withdrawals/entities/pix-key.entity";

export interface CreateCommercialWithdrawInput {
  id: string;
  userId: string;
  payeeRole: CommercialWithdrawPayeeRole;
  amountCents: number;
  pixKeyId: string | null;
  pixKeyType: PixKeyType;
  pixKeyEncrypted: string;
  holderCpf: string;
  lockWalletTransactionId: string;
}

export interface CommercialWithdrawListFilter {
  userId?: string;
  payeeRole?: CommercialWithdrawPayeeRole;
  status?: CommercialWithdrawStatus;
  page: number;
  pageSize: number;
}

export interface DecideCommercialWithdrawPatch {
  rejectionReason?: string;
  decidedByUserId: string;
  processedAt: Date;
  /**
   * Deliberately NOT set by CommercialWithdrawService.decide()'s call into
   * decide() below — see that method's doc comment: the wallet movement
   * only happens AFTER the CAS below confirms this call is the exclusive
   * winner for this id, so the settle transaction id doesn't exist yet at
   * CAS time. Kept on this type for callers/tests that already have one in
   * hand; attachSettleTransaction() is the real path the service uses.
   */
  settleWalletTransactionId?: string;
}

export interface ICommercialWithdrawRepository {
  create(input: CreateCommercialWithdrawInput): Promise<CommercialWithdraw>;
  findById(id: string): Promise<CommercialWithdraw | null>;
  listByUser(userId: string, page: number, pageSize: number): Promise<{ items: CommercialWithdraw[]; total: number }>;
  listAdmin(filter: CommercialWithdrawListFilter): Promise<{ items: CommercialWithdrawAdminRow[]; total: number }>;
  /** Same join as listAdmin's rows, for a single id — the admin detail drawer's data source. */
  findByIdAdmin(id: string): Promise<CommercialWithdrawAdminRow | null>;
  /**
   * Compare-and-swap: only transitions if current status === fromStatus.
   * Returns the row if it won the race, null if it lost (already decided by
   * a concurrent call, or simply not PENDING anymore). This IS the
   * race-safety mechanism for approve/reject — no distributed lock needed
   * here. Implemented via `updateMany({ where: { id, status: fromStatus } })`
   * + a `count === 1` check (see the Prisma implementation).
   */
  decide(
    id: string,
    fromStatus: CommercialWithdrawStatus,
    toStatus: CommercialWithdrawStatus,
    patch: DecideCommercialWithdrawPatch
  ): Promise<CommercialWithdraw | null>;
  /** Plain, non-racy update — only ever called by the CAS winner of decide(), once, after its wallet movement has actually completed (see CommercialWithdrawService.decide's doc comment). */
  attachSettleTransaction(id: string, settleWalletTransactionId: string): Promise<void>;
  /** True if any PENDING CommercialWithdraw still references this pixKeyId — backs PixKeyService.delete's guard. */
  hasPendingForPixKey(pixKeyId: string): Promise<boolean>;
}
