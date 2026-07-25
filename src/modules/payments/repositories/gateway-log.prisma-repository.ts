import { Prisma } from "@prisma/client";
import type { GatewayLog as PrismaGatewayLog } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IGatewayLogRepository,
  CreateGatewayLogInput,
  GatewayLogListFilter,
} from "@/modules/payments/interfaces/gateway-log-repository.interface";
import type { GatewayLog } from "@/modules/payments/entities/payments.entity";

function toEntity(row: PrismaGatewayLog): GatewayLog {
  return {
    id: row.id,
    gatewayCredentialId: row.gatewayCredentialId,
    provider: row.provider,
    direction: row.direction as "outbound" | "inbound",
    endpoint: row.endpoint,
    method: row.method,
    requestSummary: row.requestSummary as Record<string, unknown> | null,
    responseSummary: row.responseSummary as Record<string, unknown> | null,
    statusCode: row.statusCode,
    durationMs: row.durationMs,
    success: row.success,
    errorMessage: row.errorMessage,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaGatewayLogRepository implements IGatewayLogRepository {
  async create(input: CreateGatewayLogInput): Promise<GatewayLog> {
    const row = await prisma.gatewayLog.create({
      data: {
        gatewayCredentialId: input.gatewayCredentialId ?? null,
        provider: input.provider ?? null,
        direction: input.direction,
        endpoint: input.endpoint,
        method: input.method ?? null,
        requestSummary:
          input.requestSummary !== undefined && input.requestSummary !== null ? toJson(input.requestSummary) : undefined,
        responseSummary:
          input.responseSummary !== undefined && input.responseSummary !== null
            ? toJson(input.responseSummary)
            : undefined,
        statusCode: input.statusCode ?? null,
        durationMs: input.durationMs ?? null,
        success: input.success,
        errorMessage: input.errorMessage ?? null,
        correlationId: input.correlationId ?? null,
      },
    });
    return toEntity(row);
  }

  async listAdmin(filter: GatewayLogListFilter): Promise<{ items: GatewayLog[]; total: number }> {
    const where: Prisma.GatewayLogWhereInput = {
      ...(filter.provider ? { provider: filter.provider } : {}),
      ...(filter.direction ? { direction: filter.direction } : {}),
      ...(filter.correlationId ? { correlationId: filter.correlationId } : {}),
      ...(filter.success !== undefined ? { success: filter.success } : {}),
      ...(filter.from || filter.to
        ? { createdAt: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.gatewayLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.gatewayLog.count({ where }),
    ]);

    return { items: rows.map(toEntity), total };
  }
}
