import { Prisma, type User as PrismaUserRow } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DeletedIdentitySnapshot, UserEntity } from "@/modules/identity/entities/user.entity";
import type {
  CreateUserRecord,
  IUserRepository,
  UpdateUserRecord,
  UserSearchResult,
} from "@/modules/identity/interfaces/user-repository.interface";
import type { UserSearchQuery } from "@/modules/identity/dto/user.dto";
import { tombstoneEmailFor, tombstoneUsernameFor } from "@/modules/identity/utils/auto-identity.util";

/** Prisma types deletedIdentitySnapshot as JsonValue — narrow it back to the shape softDelete()/restore() actually write. */
function mapUser(row: PrismaUserRow): UserEntity {
  return {
    ...row,
    deletedIdentitySnapshot: row.deletedIdentitySnapshot as DeletedIdentitySnapshot | null,
  };
}

export class PrismaUserRepository implements IUserRepository {
  async findById(id: string): Promise<UserEntity | null> {
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? mapUser(user) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    return user ? mapUser(user) : null;
  }

  async findByUsername(username: string): Promise<UserEntity | null> {
    const user = await prisma.user.findFirst({ where: { username, deletedAt: null } });
    return user ? mapUser(user) : null;
  }

  async findByCpf(cpf: string): Promise<UserEntity | null> {
    const user = await prisma.user.findFirst({ where: { cpf, deletedAt: null } });
    return user ? mapUser(user) : null;
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    const user = await prisma.user.findFirst({ where: { phone, deletedAt: null } });
    return user ? mapUser(user) : null;
  }

  async findByReferralCode(referralCode: string): Promise<UserEntity | null> {
    const user = await prisma.user.findFirst({ where: { referralCode, deletedAt: null } });
    return user ? mapUser(user) : null;
  }

  async create(data: CreateUserRecord): Promise<UserEntity> {
    const user = await prisma.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        email: data.email,
        passwordHash: data.passwordHash,
        phone: data.phone ?? null,
        cpf: data.cpf ?? null,
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
    return mapUser(user);
  }

  async update(id: string, data: UpdateUserRecord): Promise<UserEntity> {
    const user = await prisma.user.update({ where: { id }, data: data as Prisma.UserUpdateInput });
    return mapUser(user);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /**
   * email/username/phone/cpf carry plain (non-partial) @unique constraints
   * that don't exclude deletedAt rows — left untouched, a soft-deleted row
   * would hold those values forever, permanently blocking the real person
   * (or a tester) from signing up again with the same CPF/phone/email. So
   * this snapshots the current values (for restore() to read back) and then
   * tombstones the unique columns to free them up immediately.
   */
  async softDelete(id: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    const snapshot: DeletedIdentitySnapshot = {
      email: user.email,
      username: user.username,
      phone: user.phone,
      cpf: user.cpf,
    };
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedIdentitySnapshot: snapshot as unknown as Prisma.InputJsonValue,
        email: tombstoneEmailFor(id),
        username: tombstoneUsernameFor(id),
        phone: null,
        cpf: null,
      },
    });
  }

  /**
   * Writes the snapshot's original email/username/phone/cpf back onto the
   * row — availability of those values (nothing else may have claimed them
   * since the delete) is UserManagementService.restore()'s job to check
   * BEFORE calling this, same pattern as AuthService.register()'s
   * pre-create dedup checks. Legacy rows soft-deleted before this migration
   * have no snapshot — restore() for those just clears deletedAt, same as
   * before.
   */
  async restore(id: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id } });
    const snapshot = user.deletedIdentitySnapshot as DeletedIdentitySnapshot | null;
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedIdentitySnapshot: Prisma.JsonNull,
        ...(snapshot
          ? { email: snapshot.email, username: snapshot.username, phone: snapshot.phone, cpf: snapshot.cpf }
          : {}),
      },
    });
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

    return { items: items.map(mapUser), total };
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
