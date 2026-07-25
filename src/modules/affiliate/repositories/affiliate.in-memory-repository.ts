import type {
  IAffiliateRepository,
  CreateAffiliateProfileInput,
  UpdateAffiliateProfileInput,
  AffiliateProfileListFilter,
} from "@/modules/affiliate/interfaces/affiliate-repository.interface";
import type { AffiliateProfile, AffiliateProfileAdminRow } from "@/modules/affiliate/entities/affiliate.entity";

export class InMemoryAffiliateRepository implements IAffiliateRepository {
  private readonly rows = new Map<string, AffiliateProfile>();

  async create(input: CreateAffiliateProfileInput): Promise<AffiliateProfile> {
    const now = new Date();
    const row: AffiliateProfile = {
      id: crypto.randomUUID(),
      userId: input.userId,
      managerId: input.managerId ?? null,
      status: input.status ?? "PENDING",
      documentsJson: input.documentsJson ?? null,
      pixKeyEncrypted: input.pixKeyEncrypted ?? null,
      cpaOverrideCents: null,
      revShareOverridePercent: null,
      requestedAt: now,
      approvedAt: null,
      approvedById: null,
      rejectionReason: null,
      blockedAt: null,
      blockedReason: null,
      linkClicks: 0,
      canInviteAffiliates: false,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<AffiliateProfile | null> {
    return this.rows.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<AffiliateProfile | null> {
    return [...this.rows.values()].find((r) => r.userId === userId) ?? null;
  }

  /** Join fields are placeholders — this test double has no User/ManagerProfile store of its own; not exercised by any test that asserts on them. */
  async findByIdAdmin(id: string): Promise<AffiliateProfileAdminRow | null> {
    const row = this.rows.get(id);
    if (!row) return null;
    return { ...row, userName: "", userEmail: "", userPhone: null, managerName: null };
  }

  async update(id: string, input: UpdateAffiliateProfileInput): Promise<AffiliateProfile> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`AffiliateProfile ${id} not found`);
    const updated: AffiliateProfile = { ...existing, ...input, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async incrementLinkClicks(userId: string): Promise<void> {
    const row = [...this.rows.values()].find((r) => r.userId === userId);
    if (row) this.rows.set(row.id, { ...row, linkClicks: row.linkClicks + 1 });
  }

  async listAdmin(filter: AffiliateProfileListFilter): Promise<{ items: AffiliateProfileAdminRow[]; total: number }> {
    let items = [...this.rows.values()];
    if (filter.status) items = items.filter((r) => r.status === filter.status);
    if (filter.managerId) items = items.filter((r) => r.managerId === filter.managerId);
    items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = items.length;
    const start = (filter.page - 1) * filter.pageSize;
    const page = items
      .slice(start, start + filter.pageSize)
      .map((r) => ({ ...r, userName: "", userEmail: "", userPhone: null, managerName: null }));
    return { items: page, total };
  }
}
