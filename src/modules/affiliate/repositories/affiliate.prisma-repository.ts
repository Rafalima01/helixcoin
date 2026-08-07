import { Prisma } from "@prisma/client";
import type { AffiliateProfile as PrismaAffiliateProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IAffiliateRepository,
  CreateAffiliateProfileInput,
  UpdateAffiliateProfileInput,
  AffiliateProfileListFilter,
} from "@/modules/affiliate/interfaces/affiliate-repository.interface";
import type { AffiliateProfile, AffiliateProfileAdminRow } from "@/modules/affiliate/entities/affiliate.entity";

function toEntity(row: PrismaAffiliateProfile): AffiliateProfile {
  return {
    id: row.id,
    userId: row.userId,
    managerId: row.managerId,
    status: row.status,
    documentsJson: row.documentsJson as Record<string, unknown> | null,
    pixKeyEncrypted: row.pixKeyEncrypted,
    revShareOverridePercent: row.revShareOverridePercent,
    requestedAt: row.requestedAt,
    approvedAt: row.approvedAt,
    approvedById: row.approvedById,
    rejectionReason: row.rejectionReason,
    blockedAt: row.blockedAt,
    blockedReason: row.blockedReason,
    linkClicks: row.linkClicks,
    canInviteAffiliates: row.canInviteAffiliates,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const adminInclude = {
  user: { select: { firstName: true, lastName: true, email: true, phone: true } },
  manager: { select: { user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.AffiliateProfileInclude;

type AdminRow = Prisma.AffiliateProfileGetPayload<{ include: typeof adminInclude }>;

function toAdminRow(row: AdminRow): AffiliateProfileAdminRow {
  return {
    ...toEntity(row),
    userName: `${row.user.firstName} ${row.user.lastName}`.trim(),
    userEmail: row.user.email,
    userPhone: row.user.phone,
    managerName: row.manager ? `${row.manager.user.firstName} ${row.manager.user.lastName}`.trim() : null,
  };
}

export class PrismaAffiliateRepository implements IAffiliateRepository {
  async create(input: CreateAffiliateProfileInput): Promise<AffiliateProfile> {
    const row = await prisma.affiliateProfile.create({
      data: {
        userId: input.userId,
        managerId: input.managerId ?? null,
        status: input.status ?? "PENDING",
        documentsJson: input.documentsJson !== undefined && input.documentsJson !== null ? toJson(input.documentsJson) : undefined,
        pixKeyEncrypted: input.pixKeyEncrypted ?? null,
      },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<AffiliateProfile | null> {
    const row = await prisma.affiliateProfile.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByUserId(userId: string): Promise<AffiliateProfile | null> {
    const row = await prisma.affiliateProfile.findUnique({ where: { userId } });
    return row ? toEntity(row) : null;
  }

  async findByIdAdmin(id: string): Promise<AffiliateProfileAdminRow | null> {
    const row = await prisma.affiliateProfile.findUnique({ where: { id }, include: adminInclude });
    return row ? toAdminRow(row) : null;
  }

  async update(id: string, input: UpdateAffiliateProfileInput): Promise<AffiliateProfile> {
    const row = await prisma.affiliateProfile.update({
      where: { id },
      data: {
        ...(input.managerId !== undefined ? { managerId: input.managerId } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.documentsJson !== undefined
          ? { documentsJson: input.documentsJson !== null ? toJson(input.documentsJson) : Prisma.JsonNull }
          : {}),
        ...(input.pixKeyEncrypted !== undefined ? { pixKeyEncrypted: input.pixKeyEncrypted } : {}),
        ...(input.revShareOverridePercent !== undefined ? { revShareOverridePercent: input.revShareOverridePercent } : {}),
        ...(input.approvedAt !== undefined ? { approvedAt: input.approvedAt } : {}),
        ...(input.approvedById !== undefined ? { approvedById: input.approvedById } : {}),
        ...(input.rejectionReason !== undefined ? { rejectionReason: input.rejectionReason } : {}),
        ...(input.blockedAt !== undefined ? { blockedAt: input.blockedAt } : {}),
        ...(input.blockedReason !== undefined ? { blockedReason: input.blockedReason } : {}),
        ...(input.canInviteAffiliates !== undefined ? { canInviteAffiliates: input.canInviteAffiliates } : {}),
      },
    });
    return toEntity(row);
  }

  async incrementLinkClicks(userId: string): Promise<void> {
    await prisma.affiliateProfile.update({ where: { userId }, data: { linkClicks: { increment: 1 } } });
  }

  async listAdmin(filter: AffiliateProfileListFilter): Promise<{ items: AffiliateProfileAdminRow[]; total: number }> {
    const where: Prisma.AffiliateProfileWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.managerId ? { managerId: filter.managerId } : {}),
      ...(filter.search
        ? {
            user: {
              OR: [
                { email: { contains: filter.search, mode: "insensitive" } },
                { firstName: { contains: filter.search, mode: "insensitive" } },
                { lastName: { contains: filter.search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.affiliateProfile.findMany({
        where,
        include: adminInclude,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.affiliateProfile.count({ where }),
    ]);

    return { items: rows.map(toAdminRow), total };
  }
}
