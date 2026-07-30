import { prisma } from "@/lib/prisma";
import { PrismaUserReferralRepository } from "@/modules/affiliate/repositories/user-referral.prisma-repository";
import { affiliateContainer } from "@/modules/affiliate/container";
import { managerContainer } from "@/modules/manager/container";
import { MAX_COMMISSION_LEVEL } from "@/modules/affiliate/constants/affiliate.constants";
import type { INotificationRecipientResolver } from "@/modules/notifications/interfaces/notification-recipient-resolver.interface";

export class PrismaNotificationRecipientResolver implements INotificationRecipientResolver {
  private readonly userReferrals = new PrismaUserReferralRepository();

  async listAdminUserIds(): Promise<string[]> {
    const rows = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, deletedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Same referredById chain the commission engine walks (see commission.service.ts's doc comment) — stops at the first ancestor that has an AffiliateProfile, regardless of that affiliate's own status (a manager still "owns" the network relationship even if the affiliate isn't APPROVED yet). */
  async resolveManagerUserIdForUser(userId: string): Promise<string | null> {
    let currentId = userId;
    for (let i = 0; i < MAX_COMMISSION_LEVEL; i++) {
      const referredById = await this.userReferrals.findReferredById(currentId);
      if (!referredById) return null;

      const affiliate = await affiliateContainer.affiliateRepository.findByUserId(referredById);
      if (affiliate?.managerId) {
        return this.resolveManagerUserIdByManagerId(affiliate.managerId);
      }
      currentId = referredById;
    }
    return null;
  }

  async resolveManagerUserIdByManagerId(managerId: string): Promise<string | null> {
    const manager = await managerContainer.managerRepository.findById(managerId);
    return manager?.userId ?? null;
  }

  async getUserDisplayName(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, username: true } });
    return user?.firstName || user?.username || "Jogador";
  }
}
