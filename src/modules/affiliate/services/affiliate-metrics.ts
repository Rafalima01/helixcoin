import { prisma } from "@/lib/prisma";
import type { ICommissionRepository } from "@/modules/affiliate/interfaces/commission-repository.interface";

/**
 * Raw performance numbers shared by BOTH the affiliate's own dashboard
 * (affiliate.controller.ts's handleGetAffiliateDashboard, self-service, self
 * scoped) and the admin's per-affiliate performance view
 * (affiliate-admin.controller.ts's handleGetAffiliatePerformanceAdmin,
 * scoped to any affiliateId an admin picks) — pulled out here so the two
 * don't hand-roll the same Prisma/commissionRepository queries twice.
 *
 * Deliberately returns raw components only, no derived percentages — the two
 * callers build slightly different DTOs from these (the self-service
 * dashboard keeps its pre-existing `confirmedDeposits`-based conversion rate
 * unchanged; the admin view uses `ftdCount`, see AffiliatePerformanceAdminDto)
 * so extracting this helper never silently changes what a real affiliate
 * already sees on their own "Indique" tab.
 */
export interface AffiliateRawMetrics {
  commissionTotalCents: number;
  commissionTodayCents: number;
  commission7dCents: number;
  commission30dCents: number;
  balanceAvailableCents: number;
  balanceLockedCents: number;
  /** Jogadores indicados — prisma.user.count({ referredById: userId }). */
  referredCount: number;
  /** Distinct DEPOSITS (not distinct users) that generated a level-1 REVSHARE_DEPOSIT commission — see ICommissionRepository.countConfirmedDeposits's doc comment. NOT the same thing as FTD: a referred user's 2nd/3rd deposit each adds to this count too. */
  confirmedDeposits: number;
  /**
   * True First-Time-Deposit count — distinct REFERRED USERS with at least
   * one PAID deposit, counted once no matter how many deposits they go on to
   * make. `confirmedDeposits` above counts DEPOSITS, not users, so it is NOT
   * a safe stand-in for FTD (a user who deposits 3 times adds 3 to
   * confirmedDeposits but only ever counts once here).
   */
  ftdCount: number;
  /** Soma de Deposit.amountCents (status PAID) dos usuários indicados — volume bruto depositado pela rede, não o valor da comissão. */
  referredDepositTotalCents: number;
}

/**
 * `affiliateId` is `null` for a regular user who was never promoted to
 * AffiliateProfile ("Transformar em afiliado") — referral identity
 * (referredById/referralCode, see auth.service.ts's register()) is
 * INDEPENDENT of AffiliateProfile, so `referredCount`/
 * `referredDepositTotalCents` are still computed from `userId` alone.
 * Everything commission-shaped (Commission rows are always keyed by a real
 * `affiliateId`, never by a bare `userId`) is structurally zero when there's
 * no AffiliateProfile — a user who was never approved as an affiliate can
 * never have earned a real commission, so this isn't a fallback/guess, it's
 * the only value that can possibly be correct.
 */
export async function getAffiliateRawMetrics(
  commissionRepository: ICommissionRepository,
  affiliateId: string | null,
  userId: string
): Promise<AffiliateRawMetrics> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [total, today, last7d, last30d, available, locked, confirmedDeposits, referredCount, ftdCount, referredDeposits] =
    await Promise.all([
      // payeeUserId (not affiliateId alone) — a MANAGER_SPREAD row can carry
      // this SAME affiliateId when triggered by this affiliate's traffic but
      // pays the MANAGER, not this affiliate (see commission.service.ts).
      affiliateId ? commissionRepository.sumAmountCents({ affiliateId, payeeUserId: userId }) : Promise.resolve(0),
      affiliateId
        ? commissionRepository.sumAmountCents({ affiliateId, payeeUserId: userId, from: startOfToday })
        : Promise.resolve(0),
      affiliateId
        ? commissionRepository.sumAmountCents({ affiliateId, payeeUserId: userId, from: sevenDaysAgo })
        : Promise.resolve(0),
      affiliateId
        ? commissionRepository.sumAmountCents({ affiliateId, payeeUserId: userId, from: thirtyDaysAgo })
        : Promise.resolve(0),
      affiliateId
        ? commissionRepository.sumAmountCents({ affiliateId, payeeUserId: userId, status: "AVAILABLE" })
        : Promise.resolve(0),
      affiliateId
        ? commissionRepository.sumAmountCents({ affiliateId, payeeUserId: userId, status: "LOCKED" })
        : Promise.resolve(0),
      affiliateId ? commissionRepository.countConfirmedDeposits(affiliateId) : Promise.resolve(0),
      prisma.user.count({ where: { referredById: userId } }),
      prisma.user.count({ where: { referredById: userId, deposits: { some: { status: "PAID" } } } }),
      prisma.deposit.aggregate({
        where: { user: { referredById: userId }, status: "PAID" },
        _sum: { amountCents: true },
      }),
    ]);

  return {
    commissionTotalCents: total,
    commissionTodayCents: today,
    commission7dCents: last7d,
    commission30dCents: last30d,
    balanceAvailableCents: available,
    balanceLockedCents: locked,
    referredCount,
    confirmedDeposits,
    ftdCount,
    referredDepositTotalCents: referredDeposits._sum.amountCents ?? 0,
  };
}
