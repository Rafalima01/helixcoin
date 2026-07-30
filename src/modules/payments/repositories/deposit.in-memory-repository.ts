import type {
  IDepositRepository,
  CreateDepositInput,
  UpdateDepositInput,
  DepositListFilter,
} from "@/modules/payments/interfaces/deposit-repository.interface";
import type { Deposit, DepositAdminRow } from "@/modules/payments/entities/payments.entity";

export class InMemoryDepositRepository implements IDepositRepository {
  private readonly rows = new Map<string, Deposit>();

  async create(input: CreateDepositInput): Promise<Deposit> {
    const now = new Date();
    const row: Deposit = {
      id: input.id,
      userId: input.userId,
      gatewayCredentialId: input.gatewayCredentialId,
      amountCents: input.amountCents,
      status: input.status ?? "PENDING",
      providerTransactionId: input.providerTransactionId ?? null,
      pixCode: input.pixCode ?? null,
      qrCodeUrl: input.qrCodeUrl ?? null,
      expiresAt: input.expiresAt ?? null,
      walletTransactionId: null,
      confirmedAt: null,
      failureReason: null,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<Deposit | null> {
    return this.rows.get(id) ?? null;
  }

  async findByProviderTransactionId(providerTransactionId: string): Promise<Deposit | null> {
    return [...this.rows.values()].find((r) => r.providerTransactionId === providerTransactionId) ?? null;
  }

  async update(id: string, input: UpdateDepositInput): Promise<Deposit> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Deposit ${id} not found`);
    const updated: Deposit = { ...existing, ...input, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  /** Join fields are placeholders — this test double has no User/GatewayCredential store of its own; not exercised by any test that asserts on them. */
  async listAdmin(filter: DepositListFilter): Promise<{ items: DepositAdminRow[]; total: number }> {
    let items = [...this.rows.values()];
    if (filter.userId) items = items.filter((r) => r.userId === filter.userId);
    if (filter.status) items = items.filter((r) => r.status === filter.status);
    if (filter.gatewayCredentialId) items = items.filter((r) => r.gatewayCredentialId === filter.gatewayCredentialId);
    if (filter.from) items = items.filter((r) => r.createdAt >= filter.from!);
    if (filter.to) items = items.filter((r) => r.createdAt <= filter.to!);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const page = items
      .slice(start, start + filter.pageSize)
      .map((r) => ({ ...r, userName: "", userEmail: "", gatewayName: "", gatewayProvider: "MOCK" as const }));
    return { items: page, total };
  }

  /** Join fields are placeholders — see listAdmin's doc comment. */
  async findByIdAdmin(id: string): Promise<DepositAdminRow | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    return { ...row, userName: "", userEmail: "", gatewayName: "", gatewayProvider: "MOCK" };
  }

  async findStuckPending(olderThan: Date): Promise<Deposit[]> {
    return [...this.rows.values()]
      .filter((r) => (r.status === "PENDING" || r.status === "PROCESSING") && r.updatedAt < olderThan)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  }
}
