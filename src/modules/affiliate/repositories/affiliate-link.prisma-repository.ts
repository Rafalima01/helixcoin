import type { AffiliateLink as PrismaAffiliateLink } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IAffiliateLinkRepository,
  CreateAffiliateLinkInput,
  UpdateAffiliateLinkInput,
} from "@/modules/affiliate/interfaces/affiliate-link-repository.interface";
import type { AffiliateLink } from "@/modules/affiliate/entities/affiliate.entity";

function toEntity(row: PrismaAffiliateLink): AffiliateLink {
  return {
    id: row.id,
    affiliateId: row.affiliateId,
    name: row.name,
    slug: row.slug,
    status: row.status,
    clicks: row.clicks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaAffiliateLinkRepository implements IAffiliateLinkRepository {
  async create(input: CreateAffiliateLinkInput): Promise<AffiliateLink> {
    const row = await prisma.affiliateLink.create({
      data: { affiliateId: input.affiliateId, name: input.name, slug: input.slug },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<AffiliateLink | null> {
    const row = await prisma.affiliateLink.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findBySlug(slug: string): Promise<AffiliateLink | null> {
    const row = await prisma.affiliateLink.findUnique({ where: { slug } });
    return row ? toEntity(row) : null;
  }

  async listForAffiliate(affiliateId: string): Promise<AffiliateLink[]> {
    const rows = await prisma.affiliateLink.findMany({ where: { affiliateId }, orderBy: { createdAt: "desc" } });
    return rows.map(toEntity);
  }

  async update(id: string, input: UpdateAffiliateLinkInput): Promise<AffiliateLink> {
    const row = await prisma.affiliateLink.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    return toEntity(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.affiliateLink.delete({ where: { id } });
  }

  async incrementClicks(id: string): Promise<void> {
    await prisma.affiliateLink.update({ where: { id }, data: { clicks: { increment: 1 } } });
  }
}
