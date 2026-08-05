import type {
  ManagerProfile,
  ManagerProfileAdminRow,
  ManagerDashboardStats,
  ManagerLinksData,
  AffiliateNetworkStatsRow,
} from "@/modules/manager/entities/manager.entity";
import { toAffiliateProfileAdminDto, type AffiliateProfileAdminDto } from "@/modules/affiliate/dto/affiliate.dto";

export interface ManagerProfileDto {
  id: string;
  inviteCode: string;
  commissionPercent: number;
  status: string;
  /** The ManagerInvite that created this profile — see "Convite de origem" in the admin drawer. */
  inviteId: string | null;
  createdAt: string;
}

export function toManagerProfileDto(entity: ManagerProfile): ManagerProfileDto {
  return {
    id: entity.id,
    inviteCode: entity.inviteCode,
    commissionPercent: entity.commissionPercent,
    status: entity.status,
    inviteId: entity.inviteId,
    createdAt: entity.createdAt.toISOString(),
  };
}

export interface ManagerProfileAdminDto extends ManagerProfileDto {
  userId: string;
  userName: string;
  userEmail: string;
  userReferralCode: string;
  affiliateCount: number;
  platformLinkClicks: number;
  inviteLinkClicks: number;
  updatedAt: string;
}

export function toManagerProfileAdminDto(row: ManagerProfileAdminRow): ManagerProfileAdminDto {
  return {
    ...toManagerProfileDto(row),
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    userReferralCode: row.userReferralCode,
    affiliateCount: row.affiliateCount,
    platformLinkClicks: row.platformLinkClicks,
    inviteLinkClicks: row.inviteLinkClicks,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type ManagerDashboardDto = ManagerDashboardStats;
export type ManagerLinksDto = ManagerLinksData;

/** "Minha Rede" row — the affiliate's admin card plus the financial rollup (see AffiliateNetworkStatsRow). */
export interface AffiliateNetworkStatsDto extends AffiliateProfileAdminDto {
  depositTotalCents: number;
  activePlayers: number;
  ftdCount: number;
  commissionGeneratedCents: number;
  paidToAffiliateCents: number;
  keptByManagerCents: number;
  houseProfitCents: number;
}

export function toAffiliateNetworkStatsDto(row: AffiliateNetworkStatsRow): AffiliateNetworkStatsDto {
  return {
    ...toAffiliateProfileAdminDto(row),
    depositTotalCents: row.depositTotalCents,
    activePlayers: row.activePlayers,
    ftdCount: row.ftdCount,
    commissionGeneratedCents: row.commissionGeneratedCents,
    paidToAffiliateCents: row.paidToAffiliateCents,
    keptByManagerCents: row.keptByManagerCents,
    houseProfitCents: row.houseProfitCents,
  };
}
