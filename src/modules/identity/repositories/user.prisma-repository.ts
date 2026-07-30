import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UserEntity } from "@/modules/identity/entities/user.entity";
import type {
  CreateUserRecord,
  IUserRepository,
  UpdateUserRecord,
  UserSearchResult,
} from "@/modules/identity/interfaces/user-repository.interface";
import type { UserSearchQuery } from "@/modules/identity/dto/user.dto";

export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    return prisma.user.findFirst({ where: { username, deletedAt: null } });
  }

  async findByReferralCode(referralCode: string): Promise<UserEntity | null> {
    return prisma.user.findFirst({ where: { referralCode, deletedAt: null } });
  }

  async create(data: CreateUserRecord): Promise<UserEntity> {
    return prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        email: data.email,
        passwordHash: data.passwordHash,
        phone: data.phone ?? null,
        role: data.role ?? "USER",
        status: data.status ?? "PENDING",
        referralCode: data.referralCode,
        referredById: data.referredById ?? null,
        affiliateLinkId: data.affiliateLinkId ?? null,
        signupSource: data.signupSource ?? null,
        eligibleForFirstDepositBonus: data.eligibleForFirstDepositBonus ?? false,
        isDemo: data.isDemo ?? false,
        tags: data.tags ?? [],
        wallet: { create: { balance: 0 } },
      },
    });
  }

  async update(id: string, data: UpdateUserRecord): Promise<UserEntity> {
    return prisma.user.update({ where: { id }, data: data as Prisma.UserUpdateInput });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async softDelete(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { deletedAt: null } });
  }

  async search(query: UserSearchQuery): Promise<UserSearchResult> {
    const where: Prisma.UserWhereInput = {
      deletedAt: query.includeDeleted ? undefined : null,
    };

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { username: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
        { cpf: { contains: term, mode: "insensitive" } },
        { id: term },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.role) where.role = query.role;
    if (query.emailVerified !== undefined) {
      where.emailVerifiedAt = query.emailVerified ? { not: null } : null;
    }
    if (query.phoneVerified !== undefined) {
      where.phoneVerifiedAt = query.phoneVerified ? { not: null } : null;
    }
    if (query.mfaEnabled !== undefined) where.mfaEnabled = query.mfaEnabled;
    if (query.locked !== undefined) {
      where.lockedUntil = query.locked ? { gt: new Date() } : null;
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
        ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  async incrementLoginAttempts(id: string): Promise<number> {
    const user = await prisma.user.update({
      where: { id },
      data: { loginAttempts: { increment: 1 } },
      select: { loginAttempts: true },
    });
    return user.loginAttempts;
  }

  async resetLoginAttempts(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { loginAttempts: 0, lockedUntil: null } });
  }

  async setLockedUntil(id: string, until: Date | null): Promise<void> {
    await prisma.user.update({ where: { id }, data: { lockedUntil: until } });
  }

  async recordLogin(id: string, at: Date): Promise<void> {
    await prisma.user.update({ where: { id }, data: { lastLoginAt: at } });
  }
}
