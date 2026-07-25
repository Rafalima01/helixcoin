import { prisma } from "@/lib/prisma";
import type {
  IGatewayHealthRepository,
  CreateGatewayHealthInput,
} from "@/modules/payments/interfaces/gateway-health-repository.interface";
import type { GatewayHealth } from "@/modules/payments/entities/payments.entity";
import type { GatewayHealth as PrismaGatewayHealth } from "@prisma/client";

function toEntity(row: PrismaGatewayHealth): GatewayHealth {
  return {
    id: row.id,
    gatewayCredentialId: row.gatewayCredentialId,
    status: row.status,
    latencyMs: row.latencyMs,
    message: row.message,
    checkedAt: row.checkedAt,
  };
}

export class PrismaGatewayHealthRepository implements IGatewayHealthRepository {
  async create(input: CreateGatewayHealthInput): Promise<GatewayHealth> {
    const row = await prisma.gatewayHealth.create({
      data: {
        gatewayCredentialId: input.gatewayCredentialId,
        status: input.status,
        latencyMs: input.latencyMs ?? null,
        message: input.message ?? null,
      },
    });
    return toEntity(row);
  }

  async findLatest(gatewayCredentialId: string): Promise<GatewayHealth | null> {
    const row = await prisma.gatewayHealth.findFirst({
      where: { gatewayCredentialId },
      orderBy: { checkedAt: "desc" },
    });
    return row ? toEntity(row) : null;
  }
}
