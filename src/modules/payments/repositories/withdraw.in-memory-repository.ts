import type {
  IWithdrawRepository,
  CreateWithdrawInput,
  UpdateWithdrawInput,
  WithdrawListFilter,
} from "@/modules/payments/interfaces/withdraw-repository.interface";
import type { Withdraw, WithdrawAdminRow } from "@/modules/payments/entities/payments.entity";

export class InMemoryWithdrawRepository implements IWithdrawRepository {
  private readonly rows = new Map<string, Withdraw>();

  async create(input: CreateWithdrawInput): Promise<Withdraw> {
    const now = new Date();
    const row: Withdraw = {
      id: input.id,
      userId: input.userId,
      gatewayCredentialId: input.gatewayCredentialId,
      isSimulated: input.isSimulated ?? false,
      amountCents: input.amountCents,
      status: input.status ?? "PENDING",
      pixKeyEncrypted: input.pixKeyEncrypted,
      pixKeyType: input.pixKeyType ?? null,
      providerTransactionId: input.providerTransactionId ?? null,
      lockWalletTransactionId: input.lockWalletTransactionId ?? null,
      settleWalletTransactionId: null,
      requestedAt: now,
      processedAt: null,
      rejectionReason: null,
      failureReason: null,
      metadata: input.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<Withdraw | null> {
    return this.rows.get(id) ?? null;
  }

  async findByProviderTransactionId(providerTransactionId: string): Promise<Withdraw | null> {
    return [...this.rows.values()].find((r) => r.providerTransactionId === providerTransactionId) ?? null;
  }

  async update(id: string, input: UpdateWithdrawInput): Promise<Withdraw> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`Withdraw ${id} not found`);
    const updated: Withdraw = { ...existing, ...input, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  /** Join fields are placeholders — this test double has no User/GatewayCredential store of its own; not exercised by any test that asserts on them. */
  async listAdmin(filter: WithdrawListFilter): Promise<{ items: WithdrawAdminRow[]; total: number }> {
    let items = [...this.rows.values()];
    if (filter.userId) items = items.filter((r) => r.userId === filter.userId);
    if (filter.status) items = items.filter((r) => r.status === filter.status);
    if (filter.gatewayCredentialId) items = items.filter((r) => r.gatewayCredentialId === filter.gatewayCredentialId);
    if (filter.isSimulated !== undefined) items = items.filter((r) => r.isSimulated === filter.isSimulated);
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
  async findByIdAdmin(id: string): Promise<WithdrawAdminRow | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    return { ...row, userName: "", userEmail: "", gatewayName: "", gatewayProvider: "MOCK" };
  }

  /** Mirrors the Prisma repo's CAS, including the `isSimulated` guard. */
  async decideSimulated(
    id: string,
    fromStatus: Withdraw["status"],
    toStatus: Withdraw["status"],
    patch: { processedAt: Date; rejectionReason?: string | null }
  ): Promise<Withdraw | null> {
    const existing = this.rows.get(id);
    if (!existing || !existing.isSimulated || existing.status !== fromStatus) return null;
    const updated: Withdraw = {
      ...existing,
      status: toStatus,
      processedAt: patch.processedAt,
      ...(patch.rejectionReason !== undefined ? { rejectionReason: patch.rejectionReason } : {}),
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async findStuckPending(olderThan: Date): Promise<Withdraw[]> {
    return [...this.rows.values()]
      .filter((r) => (r.status === "PENDING" || r.status === "PROCESSING") && !r.isSimulated && r.updatedAt < olderThan)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  }
}
