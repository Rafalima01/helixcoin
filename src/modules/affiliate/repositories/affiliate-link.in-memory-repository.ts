import type {
  IAffiliateLinkRepository,
  CreateAffiliateLinkInput,
  UpdateAffiliateLinkInput,
} from "@/modules/affiliate/interfaces/affiliate-link-repository.interface";
import type { AffiliateLink } from "@/modules/affiliate/entities/affiliate.entity";

export class InMemoryAffiliateLinkRepository implements IAffiliateLinkRepository {
  private readonly rows = new Map<string, AffiliateLink>();

  async create(input: CreateAffiliateLinkInput): Promise<AffiliateLink> {
    const now = new Date();
    const row: AffiliateLink = {
      id: crypto.randomUUID(),
      affiliateId: input.affiliateId,
      name: input.name,
      slug: input.slug,
      status: "ACTIVE",
      clicks: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<AffiliateLink | null> {
    return this.rows.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<AffiliateLink | null> {
    return [...this.rows.values()].find((r) => r.slug === slug) ?? null;
  }

  async listForAffiliate(affiliateId: string): Promise<AffiliateLink[]> {
    return [...this.rows.values()]
      .filter((r) => r.affiliateId === affiliateId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async update(id: string, input: UpdateAffiliateLinkInput): Promise<AffiliateLink> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`AffiliateLink ${id} not found`);
    const updated: AffiliateLink = { ...existing, ...input, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async incrementClicks(id: string): Promise<void> {
    const existing = this.rows.get(id);
    if (!existing) return;
    this.rows.set(id, { ...existing, clicks: existing.clicks + 1 });
  }
}
