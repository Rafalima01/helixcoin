import type {
  IGatewayLogRepository,
  CreateGatewayLogInput,
  GatewayLogListFilter,
} from "@/modules/payments/interfaces/gateway-log-repository.interface";
import type { GatewayLog } from "@/modules/payments/entities/payments.entity";

export class InMemoryGatewayLogRepository implements IGatewayLogRepository {
  private readonly rows: GatewayLog[] = [];

  async create(input: CreateGatewayLogInput): Promise<GatewayLog> {
    const row: GatewayLog = {
      id: crypto.randomUUID(),
      gatewayCredentialId: input.gatewayCredentialId ?? null,
      provider: input.provider ?? null,
      direction: input.direction,
      endpoint: input.endpoint,
      method: input.method ?? null,
      requestSummary: input.requestSummary ?? null,
      responseSummary: input.responseSummary ?? null,
      statusCode: input.statusCode ?? null,
      durationMs: input.durationMs ?? null,
      success: input.success,
      errorMessage: input.errorMessage ?? null,
      correlationId: input.correlationId ?? null,
      createdAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }

  async listAdmin(filter: GatewayLogListFilter): Promise<{ items: GatewayLog[]; total: number }> {
    let items = [...this.rows];
    if (filter.provider) items = items.filter((r) => r.provider === filter.provider);
    if (filter.direction) items = items.filter((r) => r.direction === filter.direction);
    if (filter.correlationId) items = items.filter((r) => r.correlationId === filter.correlationId);
    if (filter.success !== undefined) items = items.filter((r) => r.success === filter.success);
    if (filter.from) items = items.filter((r) => r.createdAt >= filter.from!);
    if (filter.to) items = items.filter((r) => r.createdAt <= filter.to!);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    return { items: items.slice(start, start + filter.pageSize), total };
  }
}
