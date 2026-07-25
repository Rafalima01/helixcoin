import type {
  IManagerRepository,
  CreateManagerProfileInput,
  UpdateManagerProfileInput,
  ManagerProfileListFilter,
} from "@/modules/manager/interfaces/manager-repository.interface";
import type { ManagerProfile, ManagerProfileAdminRow } from "@/modules/manager/entities/manager.entity";

export class InMemoryManagerRepository implements IManagerRepository {
  private readonly rows = new Map<string, ManagerProfile>();

  async create(input: CreateManagerProfileInput): Promise<ManagerProfile> {
    const now = new Date();
    const row: ManagerProfile = {
      id: crypto.randomUUID(),
      userId: input.userId,
      inviteCode: input.inviteCode,
      commissionPercent: input.commissionPercent,
      status: input.status,
      inviteId: input.inviteId ?? null,
      platformLinkClicks: 0,
      inviteLinkClicks: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<ManagerProfile | null> {
    return this.rows.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<ManagerProfile | null> {
    return [...this.rows.values()].find((r) => r.userId === userId) ?? null;
  }

  async findByInviteCode(inviteCode: string): Promise<ManagerProfile | null> {
    return [...this.rows.values()].find((r) => r.inviteCode === inviteCode) ?? null;
  }

  /** Join fields are placeholders — this test double has no User/AffiliateProfile store of its own. */
  async findByIdAdmin(id: string): Promise<ManagerProfileAdminRow | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    return { ...row, userName: "", userEmail: "", userReferralCode: "", affiliateCount: 0 };
  }

  async listAdmin(filter: ManagerProfileListFilter): Promise<{ items: ManagerProfileAdminRow[]; total: number }> {
    const items = [...this.rows.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const page = items.slice(start, start + filter.pageSize).map((r) => ({ ...r, userName: "", userEmail: "", userReferralCode: "", affiliateCount: 0 }));
    return { items: page, total };
  }

  async update(id: string, data: UpdateManagerProfileInput): Promise<ManagerProfile> {
    const row = this.rows.get(id);
    if (!row) throw new Error(`ManagerProfile ${id} not found`);
    const updated: ManagerProfile = {
      ...row,
      commissionPercent: data.commissionPercent ?? row.commissionPercent,
      status: data.status ?? row.status,
      updatedAt: new Date(),
    };
    this.rows.set(id, updated);
    return updated;
  }

  async incrementPlatformLinkClicks(userId: string): Promise<void> {
    const row = [...this.rows.values()].find((r) => r.userId === userId);
    if (row) this.rows.set(row.id, { ...row, platformLinkClicks: row.platformLinkClicks + 1 });
  }

  async incrementInviteLinkClicks(inviteCode: string): Promise<void> {
    const row = [...this.rows.values()].find((r) => r.inviteCode === inviteCode);
    if (row) this.rows.set(row.id, { ...row, inviteLinkClicks: row.inviteLinkClicks + 1 });
  }
}
