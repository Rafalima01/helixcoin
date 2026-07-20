import { prisma } from "@/lib/prisma";
import type {
  IPasswordResetTokenRepository,
  StoredToken,
} from "@/modules/identity/interfaces/token-repository.interface";

export class PrismaPasswordResetTokenRepository implements IPasswordResetTokenRepository {
  async create(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    requestIp: string | null
  ): Promise<StoredToken> {
    return prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt, requestIp },
    });
  }

  async findValidByHash(tokenHash: string): Promise<StoredToken | null> {
    return prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async markUsed(id: string): Promise<void> {
    await prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
