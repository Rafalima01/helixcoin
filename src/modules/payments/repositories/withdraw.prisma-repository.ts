import { Prisma } from "@prisma/client";
import type { Withdraw as PrismaWithdraw } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IWithdrawRepository,
  CreateWithdrawInput,
  UpdateWithdrawInput,
  WithdrawListFilter,
} from "@/modules/payments/interfaces/withdraw-repository.interface";
import type { Withdraw, WithdrawAdminRow } from "@/modules/payments/entities/payments.entity";

function toEntity(row: PrismaWithdraw): Withdraw {
  return {
    id: row.id,
    userId: row.userId,
    gatewayCredentialId: row.gatewayCredentialId,
    isSimulated: row.isSimulated,
    amountCents: row.amountCents,
    status: row.status,
    pixKeyEncrypted: row.pixKeyEncrypted,
    pixKeyType: row.pixKeyType,
    providerTransactionId: row.providerTransactionId,
    lockWalletTransactionId: row.lockWalletTransactionId,
    settleWalletTransactionId: row.settleWalletTransactionId,
    requestedAt: row.requestedAt,
    processedAt: row.processedAt,
    rejectionReason: row.rejectionReason,
    failureReason: row.failureReason,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaWithdrawRepository implements IWithdrawRepository {
  async create(input: CreateWithdrawInput): Promise<Withdraw> {
    const row = await prisma.withdraw.create({
      data: {
        id: input.id,
        userId: input.userId,
        gatewayCredentialId: input.gatewayCredentialId,
        isSimulated: input.isSimulated ?? false,
        amountCents: input.amountCents,
        status: input.status ?? "PENDING",
        pixKeyEncrypted: input.pixKeyEncrypted,
        pixKeyType: input.pixKeyType ?? null,
        providerTransactionId: input.providerTransactionId ?? null,
        lockWalletTransactionId: input.lockWalletTransactionId ?? null,
        metadata: input.metadata !== undefined && input.metadata !== null ? toJson(input.metadata) : undefined,
      },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<Withdraw | null> {
    const row = await prisma.withdraw.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByProviderTransactionId(providerTransactionId: string): Promise<Withdraw | null> {
    const row = await prisma.withdraw.findUnique({ where: { providerTransactionId } });
    return row ? toEntity(row) : null;
  }

  async findByIdAdmin(id: string): Promise<WithdrawAdminRow | null> {
    const row = await prisma.withdraw.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        gatewayCredential: { select: { name: true, provider: true } },
      },
    });
    if (!row) return null;
    return {
      ...toEntity(row),
      userName: `${row.user.firstName} ${row.user.lastName}`.trim(),
      userEmail: row.user.email,
      gatewayName: row.gatewayCredential?.name ?? null,
      gatewayProvider: row.gatewayCredential?.provider ?? null,
    };
  }

  async update(id: string, input: UpdateWithdrawInput): Promise<Withdraw> {
    const row = await prisma.withdraw.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.providerTransactionId !== undefined
          ? { providerTransactionId: input.providerTransactionId }
          : {}),
        ...(input.settleWalletTransactionId !== undefined
          ? { settleWalletTransactionId: input.settleWalletTransactionId }
          : {}),
        ...(input.processedAt !== undefined ? { processedAt: input.processedAt } : {}),
        ...(input.rejectionReason !== undefined ? { rejectionReason: input.rejectionReason } : {}),
        ...(input.failureReason !== undefined ? { failureReason: input.failureReason } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata !== null ? toJson(input.metadata) : Prisma.JsonNull }
          : {}),
      },
    });
    return toEntity(row);
  }

  async listAdmin(filter: WithdrawListFilter): Promise<{ items: WithdrawAdminRow[]; total: number }> {
    const where: Prisma.WithdrawWhereInput = {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.gatewayCredentialId ? { gatewayCredentialId: filter.gatewayCredentialId } : {}),
      ...(filter.isSimulated !== undefined ? { isSimulated: filter.isSimulated } : {}),
      ...(filter.from || filter.to
        ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.withdraw.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          gatewayCredential: { select: { name: true, provider: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.withdraw.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        ...toEntity(r),
        userName: `${r.user.firstName} ${r.user.lastName}`.trim(),
        userEmail: r.user.email,
        gatewayName: r.gatewayCredential?.name ?? null,
        gatewayProvider: r.gatewayCredential?.provider ?? null,
      })),
      total,
    };
  }

  async decideSimulated(
    id: string,
    fromStatus: PrismaWithdraw["status"],
    toStatus: PrismaWithdraw["status"],
    patch: { processedAt: Date; rejectionReason?: string | null }
  ): Promise<Withdraw | null> {
    // `isSimulated: true` in the WHERE is deliberate, not redundant: this CAS
    // can only ever move a simulated row, so it is structurally incapable of
    // settling a real withdraw — those are settled only by the webhook
    // dispatcher.
    const { count } = await prisma.withdraw.updateMany({
      where: { id, status: fromStatus, isSimulated: true },
      data: {
        status: toStatus,
        processedAt: patch.processedAt,
        ...(patch.rejectionReason !== undefined ? { rejectionReason: patch.rejectionReason } : {}),
      },
    });
    if (count === 0) return null;
    const row = await prisma.withdraw.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findStuckPending(olderThan: Date): Promise<Withdraw[]> {
    const rows = await prisma.withdraw.findMany({
      // `isSimulated: false` keeps demo simulations out of the reconciliation
      // poller entirely — that job exists solely to re-check a real gateway.
      where: { status: { in: ["PENDING", "PROCESSING"] }, isSimulated: false, updatedAt: { lt: olderThan } },
      orderBy: { updatedAt: "asc" },
    });
    return rows.map(toEntity);
  }
}
