import { Prisma } from "@prisma/client";
import type { Commission as PrismaCommission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ICommissionRepository,
  CreateCommissionInput,
  UpdateCommissionInput,
  CommissionListFilter,
  CommissionAggregateFilter,
} from "@/modules/affiliate/interfaces/commission-repository.interface";
import type { Commission, CommissionAdminRow, CommissionSourceType } from "@/modules/affiliate/entities/affiliate.entity";

function toEntity(row: PrismaCommission): Commission {
  return {
    id: row.id,
    affiliateId: row.affiliateId,
    managerId: row.managerId,
    payeeUserId: row.payeeUserId,
    level: row.level,
    originUserId: row.originUserId,
    sourceType: row.sourceType,
    triggerId: row.triggerId,
    amountCents: row.amountCents,
    percentApplied: row.percentApplied,
    status: row.status,
    walletTransactionId: row.walletTransactionId,
    unlockWalletTransactionId: row.unlockWalletTransactionId,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt,
    rejectedAt: row.rejectedAt,
    rejectionReason: row.rejectionReason,
  };
}

const adminInclude = {
  affiliate: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
  payeeUser: { select: { firstName: true, lastName: true, email: true } },
  originUser: { select: { firstName: true, lastName: true } },
} satisfies Prisma.CommissionInclude;

type AdminRow = Prisma.CommissionGetPayload<{ include: typeof adminInclude }>;

function toAdminRow(row: AdminRow): CommissionAdminRow {
  // MANAGER_SPREAD rows have no `affiliate` (see schema doc comment) — fall back to the payee (the manager) for display.
  const displayUser = row.affiliate?.user ?? row.payeeUser;
  return {
    ...toEntity(row),
    affiliateName: `${displayUser.firstName} ${displayUser.lastName}`.trim(),
    affiliateEmail: displayUser.email,
    originUserName: `${row.originUser.firstName} ${row.originUser.lastName}`.trim(),
  };
}

export class PrismaCommissionRepository implements ICommissionRepository {
  async create(input: CreateCommissionInput): Promise<Commission> {
    const row = await prisma.commission.create({
      data: {
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
      },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<Commission | null> {
    const row = await prisma.commission.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByTriggerAffiliateLevel(
    triggerId: string,
    affiliateId: string | null,
    level: number,
    sourceType: CommissionSourceType
  ): Promise<Commission | null> {
    const row = await prisma.commission.findFirst({ where: { triggerId, affiliateId, level, sourceType } });
    return row ? toEntity(row) : null;
  }

  async update(id: string, input: UpdateCommissionInput): Promise<Commission> {
    const row = await prisma.commission.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.unlockWalletTransactionId !== undefined ? { unlockWalletTransactionId: input.unlockWalletTransactionId } : {}),
        ...(input.approvedAt !== undefined ? { approvedAt: input.approvedAt } : {}),
        ...(input.rejectedAt !== undefined ? { rejectedAt: input.rejectedAt } : {}),
        ...(input.rejectionReason !== undefined ? { rejectionReason: input.rejectionReason } : {}),
      },
    });
    return toEntity(row);
  }

  async listAdmin(filter: CommissionListFilter): Promise<{ items: CommissionAdminRow[]; total: number }> {
    const where = buildWhere(filter);

    const [rows, total] = await Promise.all([
      prisma.commission.findMany({
        where,
        include: adminInclude,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.commission.count({ where }),
    ]);

    return { items: rows.map(toAdminRow), total };
  }

  async sumAmountCents(filter: CommissionAggregateFilter): Promise<number> {
    const where = buildWhere(filter);
    const result = await prisma.commission.aggregate({ where, _sum: { amountCents: true } });
    return result._sum.amountCents ?? 0;
  }

  async countConfirmedDeposits(affiliateId: string): Promise<number> {
    const rows = await prisma.commission.findMany({
      where: { affiliateId, level: 1, sourceType: "REVSHARE_DEPOSIT" },
      distinct: ["triggerId"],
      select: { triggerId: true },
    });
    return rows.length;
  }

  async getNetworkAggregates(
    managerId: string
  ): Promise<Map<string, { paidToAffiliateCents: number; keptByManagerCents: number; ftdCount: number }>> {
    // Two groupBys for the whole network — fixed query count regardless of affiliate count (see interface doc comment).
    const [grouped, depositGroups] = await Promise.all([
      prisma.commission.groupBy({
        by: ["affiliateId", "sourceType"],
        where: { managerId, affiliateId: { not: null } },
        _sum: { amountCents: true },
      }),
      // One row per (affiliateId, triggerId) pair — counting rows per affiliateId below gives the distinct-deposit count.
      prisma.commission.groupBy({
        by: ["affiliateId", "triggerId"],
        where: { managerId, affiliateId: { not: null }, level: 1, sourceType: "REVSHARE_DEPOSIT" },
      }),
    ]);

    const result = new Map<string, { paidToAffiliateCents: number; keptByManagerCents: number; ftdCount: number }>();
    for (const row of grouped) {
      const affiliateId = row.affiliateId;
      if (!affiliateId) continue;
      const entry = result.get(affiliateId) ?? { paidToAffiliateCents: 0, keptByManagerCents: 0, ftdCount: 0 };
      const amount = row._sum.amountCents ?? 0;
      if (row.sourceType === "REVSHARE_DEPOSIT" || row.sourceType === "CPA_FTD") {
        entry.paidToAffiliateCents += amount;
      } else if (row.sourceType === "MANAGER_SPREAD") {
        entry.keptByManagerCents += amount;
      }
      result.set(affiliateId, entry);
    }
    for (const row of depositGroups) {
      const affiliateId = row.affiliateId;
      if (!affiliateId) continue;
      const entry = result.get(affiliateId) ?? { paidToAffiliateCents: 0, keptByManagerCents: 0, ftdCount: 0 };
      entry.ftdCount += 1;
      result.set(affiliateId, entry);
    }
    return result;
  }
}

function buildWhere(filter: {
  affiliateId?: string;
  managerId?: string;
  payeeUserId?: string;
  status?: Commission["status"];
  sourceType?: CommissionSourceType;
  originUserId?: string;
  from?: Date;
  to?: Date;
}): Prisma.CommissionWhereInput {
  return {
    ...(filter.affiliateId ? { affiliateId: filter.affiliateId } : {}),
    ...(filter.managerId ? { managerId: filter.managerId } : {}),
    ...(filter.payeeUserId ? { payeeUserId: filter.payeeUserId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.sourceType ? { sourceType: filter.sourceType } : {}),
    ...(filter.originUserId ? { originUserId: filter.originUserId } : {}),
    ...(filter.from || filter.to
      ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
      : {}),
  };
}
