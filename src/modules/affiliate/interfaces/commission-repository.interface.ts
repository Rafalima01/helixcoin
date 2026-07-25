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
  from?: Date;
  to?: Date;
}

export interface ICommissionRepository {
  create(input: CreateCommissionInput): Promise<Commission>;
  findById(id: string): Promise<Commission | null>;
  /** Existence check for the tree-walk's idempotency guard — dedup on (triggerId, affiliateId, level) independent of the WalletService idempotency key. `affiliateId` null matches a MANAGER_SPREAD row with no affiliate in the path. */
  findByTriggerAffiliateLevel(triggerId: string, affiliateId: string | null, level: number): Promise<Commission | null>;
  update(id: string, input: UpdateCommissionInput): Promise<Commission>;
  listAdmin(filter: CommissionListFilter): Promise<{ items: CommissionAdminRow[]; total: number }>;
  /** Sum of amountCents matching the filter — the KPI rollup primitive (Comissão Hoje/7d/30d/Total). */
  sumAmountCents(filter: CommissionAggregateFilter): Promise<number>;
  /** Distinct deposits (triggerId) that generated a level-1 REVSHARE_DEPOSIT commission for this affiliate — "Depósitos confirmados" in the Resumo. */
  countConfirmedDeposits(affiliateId: string): Promise<number>;
}
