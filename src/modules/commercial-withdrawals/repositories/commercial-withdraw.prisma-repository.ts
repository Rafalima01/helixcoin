import { Prisma } from "@prisma/client";
import type { CommercialWithdraw as PrismaCommercialWithdraw } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ICommercialWithdrawRepository,
  CreateCommercialWithdrawInput,
  CommercialWithdrawListFilter,
  CommercialWithdrawSummaryFilter,
  CommercialWithdrawSummary,
  DecideCommercialWithdrawPatch,
} from "@/modules/commercial-withdrawals/interfaces/commercial-withdraw-repository.interface";
import type {
  CommercialWithdraw,
  CommercialWithdrawAdminRow,
  CommercialWithdrawPayeeRole,
  CommercialWithdrawStatus,
} from "@/modules/commercial-withdrawals/entities/commercial-withdraw.entity";

function toEntity(row: PrismaCommercialWithdraw): CommercialWithdraw {
  return {
    id: row.id,
    userId: row.userId,
    payeeRole: row.payeeRole,
    amountCents: row.amountCents,
    status: row.status,
    pixKeyId: row.pixKeyId,
    pixKeyType: row.pixKeyType,
    pixKeyEncrypted: row.pixKeyEncrypted,
    holderCpf: row.holderCpf,
    lockWalletTransactionId: row.lockWalletTransactionId,
    settleWalletTransactionId: row.settleWalletTransactionId,
    rejectionReason: row.rejectionReason,
    decidedByUserId: row.decidedByUserId,
    requestedAt: row.requestedAt,
    processedAt: row.processedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const adminInclude = {
  user: { select: { firstName: true, lastName: true, email: true } },
} satisfies Prisma.CommercialWithdrawInclude;

type AdminRow = Prisma.CommercialWithdrawGetPayload<{ include: typeof adminInclude }>;

function toAdminRow(row: AdminRow): CommercialWithdrawAdminRow {
  return {
    ...toEntity(row),
    userName: `${row.user.firstName} ${row.user.lastName}`.trim(),
    userEmail: row.user.email,
  };
}

/** Shared by listAdmin and getSummary — the "Tipo"/"Vínculo"/"Período" admin filters all bottom out in these same WHERE clauses. `userIdIn` is how "Vínculo" (Direto/De gerente) is applied — resolved from AffiliateProfile.managerId by the controller before either query runs (see commercial-withdraw.controller.ts's resolveBondUserIds). */
function buildAdminWhere(
  filter: Pick<CommercialWithdrawListFilter, "userId" | "userIdIn" | "payeeRole" | "status" | "from" | "to">
): Prisma.CommercialWithdrawWhereInput {
  return {
    ...(filter.userId ? { userId: filter.userId } : {}),
    ...(filter.userIdIn ? { userId: { in: filter.userIdIn } } : {}),
    ...(filter.payeeRole ? { payeeRole: filter.payeeRole } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.from || filter.to
      ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
      : {}),
  };
}

export class PrismaCommercialWithdrawRepository implements ICommercialWithdrawRepository {
  async create(input: CreateCommercialWithdrawInput): Promise<CommercialWithdraw> {
    const row = await prisma.commercialWithdraw.create({
      data: {
        id: input.id,
        userId: input.userId,
        payeeRole: input.payeeRole,
        amountCents: input.amountCents,
        pixKeyId: input.pixKeyId,
        pixKeyType: input.pixKeyType,
        pixKeyEncrypted: input.pixKeyEncrypted,
        holderCpf: input.holderCpf,
        lockWalletTransactionId: input.lockWalletTransactionId,
      },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<CommercialWithdraw | null> {
    const row = await prisma.commercialWithdraw.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async listByUser(userId: string, page: number, pageSize: number): Promise<{ items: CommercialWithdraw[]; total: number }> {
    const where: Prisma.CommercialWithdrawWhereInput = { userId };
    const [rows, total] = await Promise.all([
      prisma.commercialWithdraw.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.commercialWithdraw.count({ where }),
    ]);
    return { items: rows.map(toEntity), total };
  }

  async listAdmin(filter: CommercialWithdrawListFilter): Promise<{ items: CommercialWithdrawAdminRow[]; total: number }> {
    const where = buildAdminWhere(filter);

    const [rows, total] = await Promise.all([
      prisma.commercialWithdraw.findMany({
        where,
        include: adminInclude,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.commercialWithdraw.count({ where }),
    ]);

    return { items: rows.map(toAdminRow), total };
  }

  async findByIdAdmin(id: string): Promise<CommercialWithdrawAdminRow | null> {
    const row = await prisma.commercialWithdraw.findUnique({ where: { id }, include: adminInclude });
    return row ? toAdminRow(row) : null;
  }

  async decide(
    id: string,
    fromStatus: CommercialWithdrawStatus,
    toStatus: CommercialWithdrawStatus,
    patch: DecideCommercialWithdrawPatch
  ): Promise<CommercialWithdraw | null> {
    const result = await prisma.commercialWithdraw.updateMany({
      where: { id, status: fromStatus },
      data: {
        status: toStatus,
        decidedByUserId: patch.decidedByUserId,
        processedAt: patch.processedAt,
        ...(patch.rejectionReason !== undefined ? { rejectionReason: patch.rejectionReason } : {}),
        ...(patch.settleWalletTransactionId !== undefined
          ? { settleWalletTransactionId: patch.settleWalletTransactionId }
          : {}),
      },
    });

    // count === 0 means another concurrent call already won the CAS (or the
    // row simply wasn't in `fromStatus` anymore) — this call lost the race.
    if (result.count === 0) return null;

    const row = await prisma.commercialWithdraw.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async attachSettleTransaction(id: string, settleWalletTransactionId: string): Promise<void> {
    await prisma.commercialWithdraw.update({
      where: { id },
      data: { settleWalletTransactionId },
    });
  }

  async hasPendingForPixKey(pixKeyId: string): Promise<boolean> {
    const count = await prisma.commercialWithdraw.count({ where: { pixKeyId, status: "PENDING" } });
    return count > 0;
  }

  async sumApprovedAmountCents(userId: string, payeeRole: CommercialWithdrawPayeeRole): Promise<number> {
    const result = await prisma.commercialWithdraw.aggregate({
      where: { userId, payeeRole, status: "APPROVED" },
      _sum: { amountCents: true },
    });
    return result._sum.amountCents ?? 0;
  }

  /** One groupBy query, never one query per status — the summary cards on the admin Saques Comerciais page. */
  async getSummary(filter: CommercialWithdrawSummaryFilter): Promise<CommercialWithdrawSummary> {
    const where = buildAdminWhere(filter);
    const grouped = await prisma.commercialWithdraw.groupBy({
      by: ["status"],
      where,
      _sum: { amountCents: true },
      _count: { _all: true },
    });

    let pendingCents = 0;
    let totalRequestedCents = 0;
    let paidCents = 0;
    let count = 0;
    for (const row of grouped) {
      const amount = row._sum.amountCents ?? 0;
      totalRequestedCents += amount;
      count += row._count._all;
      if (row.status === "PENDING") pendingCents += amount;
      if (row.status === "APPROVED") paidCents += amount;
    }

    return { pendingCents, totalRequestedCents, paidCents, count };
  }
}
