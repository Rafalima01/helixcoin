import { Prisma } from "@prisma/client";
import type { ManagerProfile as PrismaManagerProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IManagerRepository,
  CreateManagerProfileInput,
  UpdateManagerProfileInput,
  ManagerProfileListFilter,
} from "@/modules/manager/interfaces/manager-repository.interface";
import type { ManagerProfile, ManagerProfileAdminRow } from "@/modules/manager/entities/manager.entity";

function toEntity(row: PrismaManagerProfile): ManagerProfile {
  return {
    id: row.id,
    userId: row.userId,
    inviteCode: row.inviteCode,
    commissionPercent: row.commissionPercent,
    status: row.status,
    inviteId: row.inviteId,
    platformLinkClicks: row.platformLinkClicks,
    inviteLinkClicks: row.inviteLinkClicks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const adminInclude = {
  user: { select: { firstName: true, lastName: true, email: true, referralCode: true } },
  _count: { select: { affiliates: true } },
} satisfies Prisma.ManagerProfileInclude;

type AdminRow = Prisma.ManagerProfileGetPayload<{ include: typeof adminInclude }>;

function toAdminRow(row: AdminRow): ManagerProfileAdminRow {
  return {
    ...toEntity(row),
    userName: `${row.user.firstName} ${row.user.lastName}`.trim(),
    userEmail: row.user.email,
    userReferralCode: row.user.referralCode,
    affiliateCount: row._count.affiliates,
  };
}

export class PrismaManagerRepository implements IManagerRepository {
  async create(input: CreateManagerProfileInput): Promise<ManagerProfile> {
    const row = await prisma.managerProfile.create({
      data: {
        userId: input.userId,
        inviteCode: input.inviteCode,
        commissionPercent: input.commissionPercent,
        status: input.status,
        inviteId: input.inviteId ?? null,
      },
    });
    return toEntity(row);
  }

  async update(id: string, data: UpdateManagerProfileInput): Promise<ManagerProfile> {
    const row = await prisma.managerProfile.update({
      where: { id },
      data: { commissionPercent: data.commissionPercent, status: data.status },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<ManagerProfile | null> {
    const row = await prisma.managerProfile.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByUserId(userId: string): Promise<ManagerProfile | null> {
    const row = await prisma.managerProfile.findUnique({ where: { userId } });
    return row ? toEntity(row) : null;
  }

  async findByInviteCode(inviteCode: string): Promise<ManagerProfile | null> {
    const row = await prisma.managerProfile.findUnique({ where: { inviteCode } });
    return row ? toEntity(row) : null;
  }

  async findByIdAdmin(id: string): Promise<ManagerProfileAdminRow | null> {
    const row = await prisma.managerProfile.findUnique({ where: { id }, include: adminInclude });
    return row ? toAdminRow(row) : null;
  }

  async listAdmin(filter: ManagerProfileListFilter): Promise<{ items: ManagerProfileAdminRow[]; total: number }> {
    const where: Prisma.ManagerProfileWhereInput = filter.search
      ? {
          user: {
            OR: [
              { email: { contains: filter.search, mode: "insensitive" } },
              { firstName: { contains: filter.search, mode: "insensitive" } },
              { lastName: { contains: filter.search, mode: "insensitive" } },
            ],
          },
        }
      : {};

    const [rows, total] = await Promise.all([
      prisma.managerProfile.findMany({
        where,
        include: adminInclude,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.managerProfile.count({ where }),
    ]);

    return { items: rows.map(toAdminRow), total };
  }

  async incrementPlatformLinkClicks(userId: string): Promise<void> {
    await prisma.managerProfile.updateMany({ where: { userId }, data: { platformLinkClicks: { increment: 1 } } });
  }

  async incrementInviteLinkClicks(inviteCode: string): Promise<void> {
    await prisma.managerProfile.updateMany({ where: { inviteCode }, data: { inviteLinkClicks: { increment: 1 } } });
  }
}
