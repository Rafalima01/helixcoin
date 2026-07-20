import { prisma } from "@/lib/prisma";
import type { SessionEntity } from "@/modules/identity/entities/session.entity";
import type {
  CreateSessionRecord,
  IUserSessionRepository,
} from "@/modules/identity/interfaces/session-repository.interface";

export class PrismaUserSessionRepository implements IUserSessionRepository {
  async create(data: CreateSessionRecord): Promise<SessionEntity> {
    return prisma.session.create({
      data: {
        id: data.id,
        userId: data.userId,
        familyId: data.familyId,
        ip: data.ip,
        userAgent: data.userAgent,
        os: data.os,
        browser: data.browser,
        device: data.device,
        rememberMe: data.rememberMe,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findById(id: string): Promise<SessionEntity | null> {
    return prisma.session.findUnique({ where: { id } });
  }

  async listByUser(userId: string): Promise<SessionEntity[]> {
    return prisma.session.findMany({ where: { userId }, orderBy: { lastActivityAt: "desc" } });
  }

  async touch(id: string, at: Date): Promise<void> {
    await prisma.session.update({ where: { id }, data: { lastActivityAt: at } }).catch(() => {
      // Session may have been revoked/expired concurrently — touching a
      // gone session is not an error worth surfacing to the request.
    });
  }

  async revoke(id: string, at: Date): Promise<void> {
    await prisma.session.update({ where: { id }, data: { status: "REVOKED", revokedAt: at } });
  }

  async revokeAllForUser(userId: string, at: Date, exceptId?: string): Promise<number> {
    const result = await prisma.session.updateMany({
      where: { userId, status: "ACTIVE", ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { status: "REVOKED", revokedAt: at },
    });
    return result.count;
  }

  async revokeFamily(familyId: string, at: Date): Promise<number> {
    const result = await prisma.session.updateMany({
      where: { familyId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: at },
    });
    return result.count;
  }
}
