import type { ManagerProfile, ManagerProfileAdminRow, ManagerDashboardStats, ManagerLinksData } from "@/modules/manager/entities/manager.entity";

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
