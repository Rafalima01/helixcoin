import type { AffiliateLink, AffiliateLinkStatus } from "@/modules/affiliate/entities/affiliate.entity";

export interface CreateAffiliateLinkInput {
  affiliateId: string;
  name: string;
  slug: string;
}

export interface UpdateAffiliateLinkInput {
  name?: string;
  status?: AffiliateLinkStatus;
}

export interface IAffiliateLinkRepository {
  create(input: CreateAffiliateLinkInput): Promise<AffiliateLink>;
  findById(id: string): Promise<AffiliateLink | null>;
  findBySlug(slug: string): Promise<AffiliateLink | null>;
  listForAffiliate(affiliateId: string): Promise<AffiliateLink[]>;
  update(id: string, input: UpdateAffiliateLinkInput): Promise<AffiliateLink>;
  delete(id: string): Promise<void>;
  /** Atomic increment — called on every redirect through a link's slug. */
  incrementClicks(id: string): Promise<void>;
}
