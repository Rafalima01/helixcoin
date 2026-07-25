import { Prisma } from "@prisma/client";
import type { ManagerInvite as PrismaManagerInvite } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IManagerInviteRepository,
  CreateManagerInviteInput,
  AcceptedCandidateInfo,
  ManagerInviteListFilter,
} from "@/modules/manager/interfaces/manager-invite-repository.interface";
import type { ManagerInvite, ManagerInviteAdminRow } from "@/modules/manager/entities/manager-invite.entity";

function toEntity(row: PrismaManagerInvite): ManagerInvite {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    commissionPercent: row.commissionPercent,
    initialStatus: row.initialStatus,
    tokenHash: row.tokenHash,
    status: row.status,
    expiresAt: row.expiresAt,
    createdById: row.createdById,
    acceptedAt: row.acceptedAt,
    acceptedByUserId: row.acceptedByUserId,
    acceptedIp: row.acceptedIp,
    acceptedUserAgent: row.acceptedUserAgent,
    approvalStatus: row.approvalStatus,
    approvedCommissionPercent: row.approvedCommissionPercent,
    approvedAt: row.approvedAt,
    approvedById: row.approvedById,
    rejectedAt: row.rejectedAt,
    rejectedById: row.rejectedById,
    rejectionReason: row.rejectionReason,
    revokedAt: row.revokedAt,
    revokedById: row.revokedById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const adminInclude = {
  createdBy: { select: { firstName: true, lastName: true } },
  revokedBy: { select: { firstName: true, lastName: true } },
  approvedBy: { select: { firstName: true, lastName: true } },
  rejectedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ManagerInviteInclude;

type AdminRow = Prisma.ManagerInviteGetPayload<{ include: typeof adminInclude }>;

function toAdminRow(row: AdminRow): ManagerInviteAdminRow {
  return {
    ...toEntity(row),
    createdByName: `${row.createdBy.firstName} ${row.createdBy.lastName}`.trim(),
    revokedByName: row.revokedBy ? `${row.revokedBy.firstName} ${row.revokedBy.lastName}`.trim() : null,
    approvedByName: row.approvedBy ? `${row.approvedBy.firstName} ${row.approvedBy.lastName}`.trim() : null,
    rejectedByName: row.rejectedBy ? `${row.rejectedBy.firstName} ${row.rejectedBy.lastName}`.trim() : null,
  };
}

export class PrismaManagerInviteRepository implements IManagerInviteRepository {
  async create(input: CreateManagerInviteInput): Promise<ManagerInvite> {
    const row = await prisma.managerInvite.create({
      data: {
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdById: input.createdById,
      },
    });
    return toEntity(row);
  }

  async findById(id: string): Promise<ManagerInvite | null> {
    const row = await prisma.managerInvite.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<ManagerInvite | null> {
    const row = await prisma.managerInvite.findUnique({ where: { tokenHash } });
    return row ? toEntity(row) : null;
  }

  async findByIdAdmin(id: string): Promise<ManagerInviteAdminRow | null> {
    const row = await prisma.managerInvite.findUnique({ where: { id }, include: adminInclude });
    return row ? toAdminRow(row) : null;
  }

  async listAdmin(filter: ManagerInviteListFilter): Promise<{ items: ManagerInviteAdminRow[]; total: number }> {
    const where: Prisma.ManagerInviteWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.approvalStatus ? { approvalStatus: filter.approvalStatus } : {}),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: "insensitive" } },
              { email: { contains: filter.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.managerInvite.findMany({
        where,
        include: adminInclude,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.managerInvite.count({ where }),
    ]);

    return { items: rows.map(toAdminRow), total };
  }

  async rotateToken(id: string, tokenHash: string, expiresAt: Date | null): Promise<ManagerInvite> {
    const row = await prisma.managerInvite.update({
      where: { id },
      data: { tokenHash, expiresAt, status: "ACTIVE", revokedAt: null, revokedById: null },
    });
    return toEntity(row);
  }

  async markAcceptedPendingReview(
    id: string,
    userId: string,
    candidate: AcceptedCandidateInfo,
    ip: string | null,
    userAgent: string | null
  ): Promise<ManagerInvite> {
    const row = await prisma.managerInvite.update({
      where: { id },
      data: {
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        status: "USED",
        acceptedAt: new Date(),
        acceptedByUserId: userId,
        acceptedIp: ip,
        acceptedUserAgent: userAgent,
        approvalStatus: "PENDING_REVIEW",
      },
    });
    return toEntity(row);
  }

  async markApproved(id: string, commissionPercent: number, approvedById: string): Promise<ManagerInvite> {
    const row = await prisma.managerInvite.update({
      where: { id },
      data: {
        approvalStatus: "APPROVED",
        approvedCommissionPercent: commissionPercent,
        approvedAt: new Date(),
        approvedById,
      },
    });
    return toEntity(row);
  }

  async markRejected(id: string, reason: string, rejectedById: string): Promise<ManagerInvite> {
    const row = await prisma.managerInvite.update({
      where: { id },
      data: {
        approvalStatus: "REJECTED",
        rejectedAt: new Date(),
        rejectedById,
        rejectionReason: reason,
      },
    });
    return toEntity(row);
  }

  async markRevoked(id: string, revokedById: string): Promise<ManagerInvite> {
    const row = await prisma.managerInvite.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: new Date(), revokedById },
    });
    return toEntity(row);
  }
}
