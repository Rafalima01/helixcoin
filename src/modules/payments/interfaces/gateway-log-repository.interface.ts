import type { GatewayLog, GatewayProvider } from "@/modules/payments/entities/payments.entity";

export interface CreateGatewayLogInput {
  gatewayCredentialId?: string | null;
  provider?: GatewayProvider | null;
  direction: "outbound" | "inbound";
  endpoint: string;
  method?: string | null;
  requestSummary?: Record<string, unknown> | null;
  responseSummary?: Record<string, unknown> | null;
  statusCode?: number | null;
  durationMs?: number | null;
  success: boolean;
  errorMessage?: string | null;
  correlationId?: string | null;
}

export interface GatewayLogListFilter {
  gatewayCredentialId?: string;
  provider?: GatewayProvider;
  direction?: "outbound" | "inbound";
  correlationId?: string;
  success?: boolean;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

/** Append-only — no update/delete method exposed. */
export interface IGatewayLogRepository {
  create(input: CreateGatewayLogInput): Promise<GatewayLog>;
  listAdmin(filter: GatewayLogListFilter): Promise<{ items: GatewayLog[]; total: number }>;
}
