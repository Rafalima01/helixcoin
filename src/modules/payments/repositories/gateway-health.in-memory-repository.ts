import type {
  IGatewayHealthRepository,
  CreateGatewayHealthInput,
} from "@/modules/payments/interfaces/gateway-health-repository.interface";
import type { GatewayHealth } from "@/modules/payments/entities/payments.entity";

export class InMemoryGatewayHealthRepository implements IGatewayHealthRepository {
  private readonly rows: GatewayHealth[] = [];

  async create(input: CreateGatewayHealthInput): Promise<GatewayHealth> {
    const row: GatewayHealth = {
      id: crypto.randomUUID(),
      gatewayCredentialId: input.gatewayCredentialId,
      status: input.status,
      latencyMs: input.latencyMs ?? null,
      message: input.message ?? null,
      checkedAt: new Date(),
    };
    this.rows.push(row);
    return row;
  }

  async findLatest(gatewayCredentialId: string): Promise<GatewayHealth | null> {
    // Rows are always appended in chronological call order — walking from the
    // end and taking the first match is exact even when two checks land in
    // the same millisecond (Date resolution), unlike sorting by `checkedAt`.
    for (let i = this.rows.length - 1; i >= 0; i--) {
      if (this.rows[i].gatewayCredentialId === gatewayCredentialId) return this.rows[i];
    }
    return null;
  }
}
