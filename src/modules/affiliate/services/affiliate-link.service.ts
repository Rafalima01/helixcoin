import { NotFoundError, ForbiddenError } from "@/server/errors";
import type { IAffiliateLinkRepository } from "@/modules/affiliate/interfaces/affiliate-link-repository.interface";
import type { AffiliateLink } from "@/modules/affiliate/entities/affiliate.entity";

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Owns the "named, trackable, pausable" campaign-link layer — never a second
 * attribution mechanism. Every link ultimately redirects through the exact
 * same referredById-setting signup flow as the affiliate's plain
 * /r/{referralCode} link (see src/app/r/[code]/route.ts); this service only
 * manages the slug/name/status/click-count wrapper around that.
 */
export class AffiliateLinkService {
  constructor(private readonly links: IAffiliateLinkRepository) {}

  async create(affiliateId: string, name: string): Promise<AffiliateLink> {
    const base = slugify(name) || "link";
    let slug = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await this.links.findBySlug(slug))) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    return this.links.create({ affiliateId, name, slug });
  }

  async listForAffiliate(affiliateId: string): Promise<AffiliateLink[]> {
    return this.links.listForAffiliate(affiliateId);
  }

  private async getOwned(id: string, affiliateId: string): Promise<AffiliateLink> {
    const link = await this.links.findById(id);
    if (!link) throw new NotFoundError("Link");
    if (link.affiliateId !== affiliateId) throw new ForbiddenError();
    return link;
  }

  async setStatus(id: string, affiliateId: string, status: "ACTIVE" | "PAUSED"): Promise<AffiliateLink> {
    await this.getOwned(id, affiliateId);
    return this.links.update(id, { status });
  }

  async delete(id: string, affiliateId: string): Promise<void> {
    await this.getOwned(id, affiliateId);
    await this.links.delete(id);
  }

  /** Called by the public /r/[code] redirect route on every click through a link's slug — never throws, a bad/paused slug just means "no link tagged", the core referral code redirect still works. */
  async findActiveBySlug(slug: string): Promise<AffiliateLink | null> {
    const link = await this.links.findBySlug(slug);
    if (!link || link.status !== "ACTIVE") return null;
    return link;
  }

  async registerClick(id: string): Promise<void> {
    await this.links.incrementClicks(id);
  }
}
