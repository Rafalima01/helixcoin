import type { Commission, CommissionAdminRow, CommissionStatus, CommissionSourceType } from "@/modules/affiliate/entities/affiliate.entity";

export interface CreateCommissionInput {
  id?: string;
  affiliateId: string | null;
  payeeUserId: string;
  managerId?: string | null;
  level: number;
  originUserId: string;
  sourceType: CommissionSourceType;
  triggerId: string;
  amountCents: number;
  percentApplied?: number | null;
  status?: CommissionStatus;
  walletTransactionId?: string | null;
}

export interface UpdateCommissionInput {
  status?: CommissionStatus;
  unlockWalletTransactionId?: string | null;
  approvedAt?: Date | null;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
}

export interface CommissionListFilter {
  affiliateId?: string;
  managerId?: string;
  status?: CommissionStatus;
  originUserId?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

export interface CommissionAggregateFilter {
  affiliateId?: string;
  managerId?: string;
  status?: CommissionStatus;
  sourceType?: CommissionSourceType;
  from?: Date;
  to?: Date;
}

export interface ICommissionRepository {
  create(input: CreateCommissionInput): Promise<Commission>;
  findById(id: string): Promise<Commission | null>;
  /**
   * Existence check for the tree-walk's idempotency guard — dedup on
   * (triggerId, affiliateId, level, sourceType), independent of the
   * WalletService idempotency key. `sourceType` is required in the key
   * because a MANAGER_SPREAD row triggered by an affiliate now carries that
   * SAME affiliateId (see CommissionService.generateManagerSpreadForAffiliate)
   * as the affiliate's own REVSHARE_DEPOSIT row at the same
   * (triggerId, level) — without sourceType in the key, the second
   * generate() call would false-positive match the first row and silently
   * skip creating the manager's spread.
   */
  findByTriggerAffiliateLevel(
    triggerId: string,
    affiliateId: string | null,
    level: number,
    sourceType: CommissionSourceType
  ): Promise<Commission | null>;
  update(id: string, input: UpdateCommissionInput): Promise<Commission>;
  listAdmin(filter: CommissionListFilter): Promise<{ items: CommissionAdminRow[]; total: number }>;
  /** Sum of amountCents matching the filter — the KPI rollup primitive (Comissão Hoje/7d/30d/Total). */
  sumAmountCents(filter: CommissionAggregateFilter): Promise<number>;
  /** Distinct deposits (triggerId) that generated a level-1 REVSHARE_DEPOSIT commission for this affiliate — "Depósitos confirmados" in the Resumo. */
  countConfirmedDeposits(affiliateId: string): Promise<number>;
  /**
   * Network-wide commission rollup for "Minha Rede", keyed by affiliateId —
   * ONE query for the whole network regardless of how many affiliates it
   * has (no per-affiliate round trip). `paidToAffiliateCents` sums
   * REVSHARE_DEPOSIT+CPA_FTD (what the affiliate themselves earned);
   * `keptByManagerCents` sums MANAGER_SPREAD rows tagged with that
   * affiliateId (what the manager kept from that affiliate's traffic, see
   * generateManagerSpreadForAffiliate); `ftdCount` counts CPA_FTD rows.
   * Excludes MANAGER_SPREAD rows with a null affiliateId (the manager's own
   * platform-link spread — not attributable to any affiliate).
   */
  getNetworkAggregates(managerId: string): Promise<Map<string, { paidToAffiliateCents: number; keptByManagerCents: number; ftdCount: number }>>;
}
