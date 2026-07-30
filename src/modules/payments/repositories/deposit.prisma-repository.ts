import { Prisma } from "@prisma/client";
import type { Deposit as PrismaDeposit } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IDepositRepository,
  CreateDepositInput,
  UpdateDepositInput,
  DepositListFilter,
} from "@/modules/payments/interfaces/deposit-repository.interface";
import type { Deposit, DepositAdminRow } from "@/modules/payments/entities/payments.entity";

function toEntity(row: PrismaDeposit): Deposit {
  return {
    id: row.id,
    userId: row.userId,
    gatewayCredentialId: row.gatewayCredentialId,
    amountCents: row.amountCents,
    status: row.status,
    providerTransactionId: row.providerTransactionId,
    pixCode: row.pixCode,
    qrCodeUrl: row.qrCodeUrl,
    expiresAt: row.expiresAt,
    walletTransactionId: row.walletTransactionId,
    confirmedAt: row.confirmedAt,
    failureReason: row.failureReason,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaDepositRepository implements IDepositRepository {
  async create(input: CreateDepositInput): Promise<Deposit> {
    const row = await prisma.deposit.create({
      data: {
        id: input.id,
        userId: input.userId,
        gatewayCredentialId: input.gatewayCredentialId,
        amountCents: input.amountCents,
        status: input.status ?? "PENDING",
        providerTransactionId: input.providerTransactionId ?? null,
        pixCode: input.pixCode ?? null,
        qrCodeUrl: input.qrCodeUrl ?? null,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata !== undefined && input.metadata !== null ? toJson(input.metadata) : undefined,
      },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<Deposit | null> {
    const row = await prisma.deposit.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByProviderTransactionId(providerTransactionId: string): Promise<Deposit | null> {
    const row = await prisma.deposit.findUnique({ where: { providerTransactionId } });
    return row ? toEntity(row) : null;
  }

  async findByIdAdmin(id: string): Promise<DepositAdminRow | null> {
    const row = await prisma.deposit.findUnique({
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
      gatewayName: row.gatewayCredential.name,
      gatewayProvider: row.gatewayCredential.provider,
    };
  }

  async update(id: string, input: UpdateDepositInput): Promise<Deposit> {
    const row = await prisma.deposit.update({
      where: { id },
      data: {
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.walletTransactionId !== undefined ? { walletTransactionId: input.walletTransactionId } : {}),
        ...(input.confirmedAt !== undefined ? { confirmedAt: input.confirmedAt } : {}),
        ...(input.failureReason !== undefined ? { failureReason: input.failureReason } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata !== null ? toJson(input.metadata) : Prisma.JsonNull }
          : {}),
      },
    });
    return toEntity(row);
  }

  async listAdmin(filter: DepositListFilter): Promise<{ items: DepositAdminRow[]; total: number }> {
    const where: Prisma.DepositWhereInput = {
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.gatewayCredentialId ? { gatewayCredentialId: filter.gatewayCredentialId } : {}),
      ...(filter.from || filter.to
        ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          gatewayCredential: { select: { name: true, provider: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.deposit.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        ...toEntity(r),
        userName: `${r.user.firstName} ${r.user.lastName}`.trim(),
        userEmail: r.user.email,
        gatewayName: r.gatewayCredential.name,
        gatewayProvider: r.gatewayCredential.provider,
      })),
      total,
    };
  }

  async findStuckPending(olderThan: Date): Promise<Deposit[]> {
    const rows = await prisma.deposit.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] }, updatedAt: { lt: olderThan } },
      orderBy: { updatedAt: "asc" },
    });
    return rows.map(toEntity);
  }
}
