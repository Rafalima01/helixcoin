import type { GatewayHealth, GatewayHealthStatus } from "@/modules/payments/entities/payments.entity";

export interface CreateGatewayHealthInput {
  gatewayCredentialId: string;
  status: GatewayHealthStatus;
  latencyMs?: number | null;
  message?: string | null;
}

/** Append-only — no update/delete method is exposed, same convention as LedgerEntry. */
export interface IGatewayHealthRepository {
  create(input: CreateGatewayHealthInput): Promise<GatewayHealth>;
  findLatest(gatewayCredentialId: string): Promise<GatewayHealth | null>;
}
