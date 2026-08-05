import type {
  ICommissionRepository,
  CreateCommissionInput,
  UpdateCommissionInput,
  CommissionListFilter,
  CommissionAggregateFilter,
} from "@/modules/affiliate/interfaces/commission-repository.interface";
import type { Commission, CommissionAdminRow, CommissionSourceType } from "@/modules/affiliate/entities/affiliate.entity";

export class InMemoryCommissionRepository implements ICommissionRepository {
  private readonly rows = new Map<string, Commission>();

  async create(input: CreateCommissionInput): Promise<Commission> {
    const now = new Date();
    const row: Commission = {
      id: input.id ?? crypto.randomUUID(),
      affiliateId: input.affiliateId,
      payeeUserId: input.payeeUserId,
      managerId: input.managerId ?? null,
      level: input.level,
      originUserId: input.originUserId,
      sourceType: input.sourceType,
      triggerId: input.triggerId,
      amountCents: input.amountCents,
      percentApplied: input.percentApplied ?? null,
      status: input.status ?? "LOCKED",
      walletTransactionId: input.walletTransactionId ?? null,
      unlockWalletTransactionId: null,
      createdAt: now,
      approvedAt: null,
      rejectedAt: null,
      rejectionReason: null,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<Commission | null> {
    return this.rows.get(id) ?? null;
  }

  async findByTriggerAffiliateLevel(
    triggerId: string,
    affiliateId: string | null,
    level: number,
    sourceType: CommissionSourceType
  ): Promise<Commission | null> {
    return (
      [...this.rows.values()].find(
        (r) =>
          r.triggerId === triggerId && r.affiliateId === affiliateId && r.level === level && r.sourceType === sourceType
      ) ?? null
    );
  }

  async update(id: string, input: UpdateCommissionInput): Promise<Commission> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Commission ${id} not found`);
    const updated: Commission = { ...existing, ...input };
    this.rows.set(id, updated);
    return updated;
  }

  async listAdmin(filter: CommissionListFilter): Promise<{ items: CommissionAdminRow[]; total: number }> {
    const items = this.applyFilter(filter).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const page = items
      .slice(start, start + filter.pageSize)
      .map((r) => ({ ...r, affiliateName: "", affiliateEmail: "", originUserName: "" }));
    return { items: page, total };
  }

  async sumAmountCents(filter: CommissionAggregateFilter): Promise<number> {
    return this.applyFilter(filter).reduce((sum, r) => sum + r.amountCents, 0);
  }

  async countConfirmedDeposits(affiliateId: string): Promise<number> {
    const triggerIds = new Set(
      [...this.rows.values()]
        .filter((r) => r.affiliateId === affiliateId && r.level === 1 && r.sourceType === "REVSHARE_DEPOSIT")
        .map((r) => r.triggerId)
    );
    return triggerIds.size;
  }

  async getNetworkAggregates(
    managerId: string
  ): Promise<Map<string, { paidToAffiliateCents: number; keptByManagerCents: number; ftdCount: number }>> {
    const result = new Map<string, { paidToAffiliateCents: number; keptByManagerCents: number; ftdCount: number }>();
    const depositTriggersByAffiliate = new Map<string, Set<string>>();
    for (const r of this.rows.values()) {
      if (r.managerId !== managerId || !r.affiliateId) continue;
      const entry = result.get(r.affiliateId) ?? { paidToAffiliateCents: 0, keptByManagerCents: 0, ftdCount: 0 };
      if (r.sourceType === "REVSHARE_DEPOSIT" || r.sourceType === "CPA_FTD") {
        entry.paidToAffiliateCents += r.amountCents;
      } else if (r.sourceType === "MANAGER_SPREAD") {
        entry.keptByManagerCents += r.amountCents;
      }
      result.set(r.affiliateId, entry);

      if (r.level === 1 && r.sourceType === "REVSHARE_DEPOSIT") {
        const triggers = depositTriggersByAffiliate.get(r.affiliateId) ?? new Set<string>();
        triggers.add(r.triggerId);
        depositTriggersByAffiliate.set(r.affiliateId, triggers);
      }
    }
    for (const [affiliateId, triggers] of depositTriggersByAffiliate) {
      const entry = result.get(affiliateId) ?? { paidToAffiliateCents: 0, keptByManagerCents: 0, ftdCount: 0 };
      entry.ftdCount = triggers.size;
      result.set(affiliateId, entry);
    }
    return result;
  }

  private applyFilter(filter: {
    affiliateId?: string;
    managerId?: string;
    payeeUserId?: string;
    status?: Commission["status"];
    sourceType?: CommissionSourceType;
    originUserId?: string;
    from?: Date;
    to?: Date;
  }): Commission[] {
    let items = [...this.rows.values()];
    if (filter.affiliateId) items = items.filter((r) => r.affiliateId === filter.affiliateId);
    if (filter.managerId) items = items.filter((r) => r.managerId === filter.managerId);
    if (filter.payeeUserId) items = items.filter((r) => r.payeeUserId === filter.payeeUserId);
    if (filter.status) items = items.filter((r) => r.status === filter.status);
    if (filter.sourceType) items = items.filter((r) => r.sourceType === filter.sourceType);
    if (filter.originUserId) items = items.filter((r) => r.originUserId === filter.originUserId);
    if (filter.from) items = items.filter((r) => r.createdAt >= filter.from!);
    if (filter.to) items = items.filter((r) => r.createdAt <= filter.to!);
    return items;
  }
}
