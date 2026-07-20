import { prisma } from "@/lib/prisma";
import type { IMfaMethodRepository, MfaMethodRecord } from "@/modules/identity/interfaces/mfa-repository.interface";

export class PrismaMfaMethodRepository implements IMfaMethodRepository {
  async listByUser(userId: string): Promise<MfaMethodRecord[]> {
    return prisma.mfaMethod.findMany({
      where: { userId },
      select: { id: true, userId: true, type: true, enabled: true, verifiedAt: true, createdAt: true },
    });
  }

  async countRecoveryCodes(userId: string): Promise<number> {
    return prisma.mfaRecoveryCode.count({ where: { userId, usedAt: null } });
  }
}
