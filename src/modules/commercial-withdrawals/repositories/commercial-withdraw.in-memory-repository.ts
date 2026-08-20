import type {
  ICommercialWithdrawRepository,
  CreateCommercialWithdrawInput,
  CommercialWithdrawListFilter,
  CommercialWithdrawSummaryFilter,
  CommercialWithdrawSummary,
  DecideCommercialWithdrawPatch,
} from "@/modules/commercial-withdrawals/interfaces/commercial-withdraw-repository.interface";
import type {
  CommercialWithdraw,
  CommercialWithdrawAdminRow,
  CommercialWithdrawPayeeRole,
  CommercialWithdrawStatus,
} from "@/modules/commercial-withdrawals/entities/commercial-withdraw.entity";

export class InMemoryCommercialWithdrawRepository implements ICommercialWithdrawRepository {
  private readonly rows = new Map<string, CommercialWithdraw>();

  async create(input: CreateCommercialWithdrawInput): Promise<CommercialWithdraw> {
    const now = new Date();
    const row: CommercialWithdraw = {
      id: input.id,
      userId: input.userId,
      payeeRole: input.payeeRole,
      amountCents: input.amountCents,
      status: "PENDING",
      pixKeyId: input.pixKeyId,
      pixKeyType: input.pixKeyType,
      pixKeyEncrypted: input.pixKeyEncrypted,
      holderCpf: input.holderCpf,
      lockWalletTransactionId: input.lockWalletTransactionId,
      settleWalletTransactionId: null,
      rejectionReason: null,
      decidedByUserId: null,
      requestedAt: now,
      processedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<CommercialWithdraw | null> {
    return this.rows.get(id) ?? null;
  }

  async listByUser(userId: string, page: number, pageSize: number): Promise<{ items: CommercialWithdraw[]; total: number }> {
    const items = [...this.rows.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (page - 1) * pageSize;
    return { items: items.slice(start, start + pageSize), total };
  }

  /** Mirrors the Prisma repository's buildAdminWhere filters exactly — same fields, same semantics. Join fields (userName/userEmail) are placeholders — this test double has no User store of its own; not exercised by any test that asserts on them (same convention as payments' InMemoryWithdrawRepository). */
  private applyAdminFilter(
    filter: Pick<CommercialWithdrawListFilter, "userId" | "userIdIn" | "payeeRole" | "status" | "from" | "to">
  ): CommercialWithdraw[] {
    let items = [...this.rows.values()];
    if (filter.userId) items = items.filter((r) => r.userId === filter.userId);
    if (filter.userIdIn) items = items.filter((r) => filter.userIdIn!.includes(r.userId));
    if (filter.payeeRole) items = items.filter((r) => r.payeeRole === filter.payeeRole);
    if (filter.status) items = items.filter((r) => r.status === filter.status);
    if (filter.from) items = items.filter((r) => r.createdAt >= filter.from!);
    if (filter.to) items = items.filter((r) => r.createdAt <= filter.to!);
    return items;
  }

  async listAdmin(filter: CommercialWithdrawListFilter): Promise<{ items: CommercialWithdrawAdminRow[]; total: number }> {
    const items = this.applyAdminFilter(filter).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const page = items.slice(start, start + filter.pageSize).map((r) => ({ ...r, userName: "", userEmail: "" }));
    return { items: page, total };
  }

  async findByIdAdmin(id: string): Promise<CommercialWithdrawAdminRow | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    return { ...row, userName: "", userEmail: "" };
  }

  /**
   * Synchronous check-then-write, no `await` in between — atomic with
   * respect to concurrent callers under Node's single-threaded event loop,
   * the same guarantee `updateMany`'s WHERE clause gives the real Postgres
   * implementation. This is what makes the concurrency test meaningful
   * against this test double.
   */
  async decide(
    id: string,
    fromStatus: CommercialWithdrawStatus,
    toStatus: CommercialWithdrawStatus,
    patch: DecideCommercialWithdrawPatch
  ): Promise<CommercialWithdraw | null> {
    const existing = this.rows.get(id);
    if (!existing || existing.status !== fromStatus) return null;

    const updated: CommercialWithdraw = {
      ...existing,
      status: toStatus,
      decidedByUserId: patch.decidedByUserId,
      processedAt: patch.processedAt,
      updatedAt: new Date(),
      ...(patch.rejectionReason !== undefined ? { rejectionReason: patch.rejectionReason } : {}),
      ...(patch.settleWalletTransactionId !== undefined
        ? { settleWalletTransactionId: patch.settleWalletTransactionId }
        : {}),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async attachSettleTransaction(id: string, settleWalletTransactionId: string): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) return;
    this.rows.set(id, { ...existing, settleWalletTransactionId, updatedAt: new Date() });
  }

  async hasPendingForPixKey(pixKeyId: string): Promise<boolean> {
    return [...this.rows.values()].some((r) => r.pixKeyId === pixKeyId && r.status === "PENDING");
  }

  async sumApprovedAmountCents(userId: string, payeeRole: CommercialWithdrawPayeeRole): Promise<number> {
    return [...this.rows.values()]
      .filter((r) => r.userId === userId && r.payeeRole === payeeRole && r.status === "APPROVED")
      .reduce((sum, r) => sum + r.amountCents, 0);
  }

  async getSummary(filter: CommercialWithdrawSummaryFilter): Promise<CommercialWithdrawSummary> {
    const items = this.applyAdminFilter(filter);
    let pendingCents = 0;
    let totalRequestedCents = 0;
    let paidCents = 0;
    for (const r of items) {
      totalRequestedCents += r.amountCents;
      if (r.status === "PENDING") pendingCents += r.amountCents;
      if (r.status === "APPROVED") paidCents += r.amountCents;
    }
    return { pendingCents, totalRequestedCents, paidCents, count: items.length };
  }
}
