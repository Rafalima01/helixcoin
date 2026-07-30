import { Prisma } from "@prisma/client";
import type { GatewayCredential as PrismaGatewayCredential, GatewayHealth as PrismaGatewayHealth } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IGatewayCredentialRepository,
  CreateGatewayCredentialInput,
  UpdateGatewayCredentialInput,
  GatewayCredentialListFilter,
} from "@/modules/payments/interfaces/gateway-credential-repository.interface";
import type { GatewayCredential, GatewayCredentialWithHealth } from "@/modules/payments/entities/payments.entity";

function toEntity(row: PrismaGatewayCredential): GatewayCredential {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    mode: row.mode,
    active: row.active,
    priority: row.priority,
    weight: row.weight,
    timeoutMs: row.timeoutMs,
    maxRetries: row.maxRetries,
    credentialsEncrypted: row.credentialsEncrypted,
    webhookSecretEncrypted: row.webhookSecretEncrypted,
    simulatedHealth: row.simulatedHealth,
    simulatedErrorMode: row.simulatedErrorMode,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toWithHealth(row: PrismaGatewayCredential & { health: PrismaGatewayHealth[] }): GatewayCredentialWithHealth {
  const latest = row.health[0];
  return {
    ...toEntity(row),
    latestHealth: latest
      ? {
          id: latest.id,
          gatewayCredentialId: latest.gatewayCredentialId,
          status: latest.status,
          latencyMs: latest.latencyMs,
          message: latest.message,
          checkedAt: latest.checkedAt,
        }
      : null,
  };
}

export class PrismaGatewayCredentialRepository implements IGatewayCredentialRepository {
  async findById(id: string): Promise<GatewayCredential | null> {
    const row = await prisma.gatewayCredential.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async listByProvider(provider: GatewayCredential["provider"]): Promise<GatewayCredential[]> {
    const rows = await prisma.gatewayCredential.findMany({ where: { provider } });
    return rows.map(toEntity);
  }

  async listActive(): Promise<GatewayCredential[]> {
    const rows = await prisma.gatewayCredential.findMany({ where: { active: true }, orderBy: { priority: "asc" } });
    return rows.map(toEntity);
  }

  async listAdmin(
    filter: GatewayCredentialListFilter
  ): Promise<{ items: GatewayCredentialWithHealth[]; total: number }> {
    const where: Prisma.GatewayCredentialWhereInput = {
      ...(filter.provider ? { provider: filter.provider } : {}),
      ...(filter.active !== undefined ? { active: filter.active } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.gatewayCredential.findMany({
        where,
        include: { health: { take: 1, orderBy: { checkedAt: "desc" } } },
        orderBy: { priority: "asc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.gatewayCredential.count({ where }),
    ]);

    return { items: rows.map(toWithHealth), total };
  }

  async create(input: CreateGatewayCredentialInput): Promise<GatewayCredential> {
    const row = await prisma.gatewayCredential.create({
      data: {
        id: input.id ?? crypto.randomUUID(),
        name: input.name,
        provider: input.provider,
        mode: input.mode ?? "SANDBOX",
        active: input.active ?? false,
        priority: input.priority ?? 0,
        weight: input.weight ?? 1,
        timeoutMs: input.timeoutMs ?? 15000,
        maxRetries: input.maxRetries ?? 2,
        credentialsEncrypted: input.credentialsEncrypted,
        webhookSecretEncrypted: input.webhookSecretEncrypted,
        simulatedHealth: input.simulatedHealth ?? null,
        simulatedErrorMode: input.simulatedErrorMode ?? null,
        createdById: input.createdById ?? null,
      },
    });
    return toEntity(row);
  }

  async update(id: string, input: UpdateGatewayCredentialInput): Promise<GatewayCredential> {
    const row = await prisma.gatewayCredential.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.mode !== undefined ? { mode: input.mode } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.weight !== undefined ? { weight: input.weight } : {}),
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        ...(input.maxRetries !== undefined ? { maxRetries: input.maxRetries } : {}),
        ...(input.credentialsEncrypted !== undefined ? { credentialsEncrypted: input.credentialsEncrypted } : {}),
        ...(input.webhookSecretEncrypted !== undefined
          ? { webhookSecretEncrypted: input.webhookSecretEncrypted }
          : {}),
        ...(input.simulatedHealth !== undefined ? { simulatedHealth: input.simulatedHealth } : {}),
        ...(input.simulatedErrorMode !== undefined ? { simulatedErrorMode: input.simulatedErrorMode } : {}),
      },
    });
    return toEntity(row);
  }
}
