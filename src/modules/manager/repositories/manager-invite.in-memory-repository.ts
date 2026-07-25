import type {
  IManagerInviteRepository,
  CreateManagerInviteInput,
  AcceptedCandidateInfo,
  ManagerInviteListFilter,
} from "@/modules/manager/interfaces/manager-invite-repository.interface";
import type { ManagerInvite, ManagerInviteAdminRow } from "@/modules/manager/entities/manager-invite.entity";

export class InMemoryManagerInviteRepository implements IManagerInviteRepository {
  private readonly rows = new Map<string, ManagerInvite>();

  async create(input: CreateManagerInviteInput): Promise<ManagerInvite> {
    const now = new Date();
    const row: ManagerInvite = {
      id: crypto.randomUUID(),
      name: null,
      email: null,
      phone: null,
      notes: null,
      commissionPercent: 0,
      initialStatus: "ACTIVE",
      tokenHash: input.tokenHash,
      status: "ACTIVE",
      expiresAt: input.expiresAt,
      createdById: input.createdById,
      acceptedAt: null,
      acceptedByUserId: null,
      acceptedIp: null,
      acceptedUserAgent: null,
      approvalStatus: null,
      approvedCommissionPercent: null,
      approvedAt: null,
      approvedById: null,
      rejectedAt: null,
      rejectedById: null,
      rejectionReason: null,
      revokedAt: null,
      revokedById: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<ManagerInvite | null> {
    return this.rows.get(id) ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<ManagerInvite | null> {
    return [...this.rows.values()].find((r) => r.tokenHash === tokenHash) ?? null;
  }

  /** Join fields are placeholders — this test double has no User store of its own. */
  async findByIdAdmin(id: string): Promise<ManagerInviteAdminRow | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    return { ...row, createdByName: "", revokedByName: null, approvedByName: null, rejectedByName: null };
  }

  async listAdmin(filter: ManagerInviteListFilter): Promise<{ items: ManagerInviteAdminRow[]; total: number }> {
    let items = [...this.rows.values()];
    if (filter.status) items = items.filter((r) => r.status === filter.status);
    if (filter.approvalStatus) items = items.filter((r) => r.approvalStatus === filter.approvalStatus);
    items = items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const page = items
      .slice(start, start + filter.pageSize)
      .map((r) => ({ ...r, createdByName: "", revokedByName: null, approvedByName: null, rejectedByName: null }));
    return { items: page, total };
  }

  async rotateToken(id: string, tokenHash: string, expiresAt: Date | null): Promise<ManagerInvite> {
    const row = this.rows.get(id);
    if (!row) throw new Error(`ManagerInvite ${id} not found`);
    const updated: ManagerInvite = { ...row, tokenHash, status: "ACTIVE", expiresAt, revokedAt: null, revokedById: null, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async markAcceptedPendingReview(
    id: string,
    userId: string,
    candidate: AcceptedCandidateInfo,
    ip: string | null,
    userAgent: string | null
  ): Promise<ManagerInvite> {
    const row = this.rows.get(id);
    if (!row) throw new Error(`ManagerInvite ${id} not found`);
    const updated: ManagerInvite = {
      ...row,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      status: "USED",
      acceptedAt: new Date(),
      acceptedByUserId: userId,
      acceptedIp: ip,
      acceptedUserAgent: userAgent,
      approvalStatus: "PENDING_REVIEW",
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async markApproved(id: string, commissionPercent: number, approvedById: string): Promise<ManagerInvite> {
    const row = this.rows.get(id);
    if (!row) throw new Error(`ManagerInvite ${id} not found`);
    const updated: ManagerInvite = {
      ...row,
      approvalStatus: "APPROVED",
      approvedCommissionPercent: commissionPercent,
      approvedAt: new Date(),
      approvedById,
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async markRejected(id: string, reason: string, rejectedById: string): Promise<ManagerInvite> {
    const row = this.rows.get(id);
    if (!row) throw new Error(`ManagerInvite ${id} not found`);
    const updated: ManagerInvite = {
      ...row,
      approvalStatus: "REJECTED",
      rejectedAt: new Date(),
      rejectedById,
      rejectionReason: reason,
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async markRevoked(id: string, revokedById: string): Promise<ManagerInvite> {
    const row = this.rows.get(id);
    if (!row) throw new Error(`ManagerInvite ${id} not found`);
    const updated: ManagerInvite = { ...row, status: "REVOKED", revokedAt: new Date(), revokedById, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }
}
