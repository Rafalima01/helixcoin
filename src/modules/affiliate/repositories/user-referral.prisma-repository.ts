import { prisma } from "@/lib/prisma";
import type { IUserReferralRepository } from "@/modules/affiliate/interfaces/user-referral-repository.interface";

export class PrismaUserReferralRepository implements IUserReferralRepository {
  async findReferredById(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { referredById: true } });
    return user?.referredById ?? null;
  }
}
