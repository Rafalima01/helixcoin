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
  /** Pre-resolved set of userIds — how the "Vínculo" (Direto/De gerente) admin filter is applied, since CommercialWithdraw itself carries no manager linkage (see commercial-withdraw.controller.ts's resolveBondUserIds, which resolves this from AffiliateProfile.managerId before calling listAdmin/getSummary). */
  userIdIn?: string[];
  payeeRole?: CommercialWithdrawPayeeRole;
  status?: CommercialWithdrawStatus;
  /** Filters on `createdAt` (the request's creation timestamp) — the "Período" admin filter (Hoje/7 dias/30 dias/Personalizado). */
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

/** Same filter shape as the list, minus pagination — the admin "cards de resumo" query never paginates, it aggregates. */
export type CommercialWithdrawSummaryFilter = Omit<CommercialWithdrawListFilter, "page" | "pageSize" | "status">;

export interface CommercialWithdrawSummary {
  /** Sum of amountCents where status = PENDING. */
  pendingCents: number;
  /** Sum of amountCents across every status matching the filter — "Total solicitado", deliberately NOT named after Commission to avoid confusion with that unrelated entity. */
  totalRequestedCents: number;
  /**
   * Sum of amountCents where status = APPROVED. APPROVE debits the wallet
   * synchronously (see CommercialWithdrawService.decide) — there is no
   * separate PROCESSING/PAID state in this architecture, so APPROVED IS the
   * "actually paid out" figure. Never invent a PAID status to represent this.
   */
  paidCents: number;
  /** Count of requests matching the filter, any status. */
  count: number;
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
  /** Sum of amountCents for APPROVED (actually paid out) requests — the "Comissão paga" figure on the admin Afiliados performance view (see affiliate-admin.controller.ts's handleGetAffiliatePerformanceAdmin). PENDING/REJECTED/CANCELLED never count as paid. */
  sumApprovedAmountCents(userId: string, payeeRole: CommercialWithdrawPayeeRole): Promise<number>;
  /** The "Saques Comerciais" admin page's summary cards — one aggregate query (groupBy status), never N+1. */
  getSummary(filter: CommercialWithdrawSummaryFilter): Promise<CommercialWithdrawSummary>;
}
