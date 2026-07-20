import { prisma } from "@/lib/prisma";
import type {
  IEmailVerificationTokenRepository,
  StoredEmailToken,
} from "@/modules/identity/interfaces/token-repository.interface";

export class PrismaEmailVerificationTokenRepository implements IEmailVerificationTokenRepository {
  async create(userId: string, email: string, tokenHash: string, expiresAt: Date): Promise<StoredEmailToken> {
    return prisma.emailVerificationToken.create({
      data: { userId, email, tokenHash, expiresAt },
    });
  }

  async findValidByHash(tokenHash: string): Promise<StoredEmailToken | null> {
    return prisma.emailVerificationToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async markUsed(id: string): Promise<void> {
    await prisma.emailVerificationToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
