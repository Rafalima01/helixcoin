import type {
  IGatewayCredentialRepository,
  CreateGatewayCredentialInput,
  UpdateGatewayCredentialInput,
  GatewayCredentialListFilter,
} from "@/modules/payments/interfaces/gateway-credential-repository.interface";
import type { GatewayCredential, GatewayCredentialWithHealth, GatewayHealth } from "@/modules/payments/entities/payments.entity";

/** Test double — no locking semantics needed, GatewayCredential mutations are admin-only and not concurrency-sensitive the way Wallet is. */
export class InMemoryGatewayCredentialRepository implements IGatewayCredentialRepository {
  private readonly rows = new Map<string, GatewayCredential>();
  private latestHealthByCredential = new Map<string, GatewayHealth>();

  /** Test helper — lets gateway-router tests seed a latest health row without going through GatewayHealthRepository. */
  seedLatestHealth(gatewayCredentialId: string, health: GatewayHealth): void {
    this.latestHealthByCredential.set(gatewayCredentialId, health);
  }

  async findById(id: string): Promise<GatewayCredential | null> {
    return this.rows.get(id) ?? null;
  }

  async listByProvider(provider: GatewayCredential["provider"]): Promise<GatewayCredential[]> {
    return [...this.rows.values()].filter((r) => r.provider === provider);
  }

  async listActive(): Promise<GatewayCredential[]> {
    return [...this.rows.values()].filter((r) => r.active).sort((a, b) => a.priority - b.priority);
  }

  async listAdmin(
    filter: GatewayCredentialListFilter
  ): Promise<{ items: GatewayCredentialWithHealth[]; total: number }> {
    let items = [...this.rows.values()];
    if (filter.provider) items = items.filter((r) => r.provider === filter.provider);
    if (filter.active !== undefined) items = items.filter((r) => r.active === filter.active);
    items.sort((a, b) => a.priority - b.priority);
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const withHealth = items
      .slice(start, start + filter.pageSize)
      .map((r) => ({ ...r, latestHealth: this.latestHealthByCredential.get(r.id) ?? null }));
    return { items: withHealth, total };
  }

  async create(input: CreateGatewayCredentialInput): Promise<GatewayCredential> {
    const now = new Date();
    const row: GatewayCredential = {
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
      createdById: input.createdById ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async update(id: string, input: UpdateGatewayCredentialInput): Promise<GatewayCredential> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`GatewayCredential ${id} not found`);
    const updated: GatewayCredential = { ...existing, ...input, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }
}
