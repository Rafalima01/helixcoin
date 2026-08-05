import type { AffiliateProfileAdminRow } from "@/modules/affiliate/entities/affiliate.entity";

export type ManagerProfileStatus = "ACTIVE" | "PENDING";

/** Domain entity — a thin extension of User (role MANAGER). Zero financial/platform data lives here or anywhere in this module — see AGENTS.md Phase 8 decision. */
export interface ManagerProfile {
  id: string;
  userId: string;
  inviteCode: string;
  /** The manager's maximum commission ceiling — decided by the Admin at invite-approval time (see ManagerInviteService.approve), never at invite creation. An affiliate in this manager's network can never be set above it (see AffiliateService.updateCommission). */
  commissionPercent: number;
  /** PENDING blocks /manager portal access until an Admin activates the account — see ManagerService.activateProfile. */
  status: ManagerProfileStatus;
  inviteId: string | null;
  /** "Meu Link da Plataforma" (/r/{User.referralCode}) hit-count. */
  platformLinkClicks: number;
  /** "Convidar Afiliados" (/affiliate-invite/{inviteCode}) hit-count. */
  inviteLinkClicks: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Admin list row — ManagerProfile joined with the owning user's display fields and their network size. */
export interface ManagerProfileAdminRow extends ManagerProfile {
  userName: string;
  userEmail: string;
  /** For building the "Meu Link da Plataforma" URL (/r/{code}) in the admin drawer. */
  userReferralCode: string;
  affiliateCount: number;
}

/** "Links e Convites" screen data — the two-link model (see AGENTS.md's "Refinamento Fase 8"). */
export interface ManagerLinkStats {
  url: string;
  clicks: number;
  signups: number;
  /** Absent on the invite link — "FTD" is a player-deposit concept, not an affiliate-signup one. */
  ftd?: number;
  conversionPercent: number;
}

export interface ManagerLinksData {
  /** "Meu Link da Plataforma" — /r/{referralCode}, captures players directly. */
  platformLink: ManagerLinkStats;
  /** "Convidar Afiliados" — /affiliate-invite/{inviteCode}, recruits affiliates only. */
  inviteLink: ManagerLinkStats & { code: string };
}

/**
 * "Minha Rede" row — AffiliateProfileAdminRow plus the financial rollup the
 * manager needs per affiliate. Every field here is derived from the
 * EXISTING Deposit/User/Commission tables (see ManagerService.getNetworkWithStats)
 * — nothing new is stored.
 */
export interface AffiliateNetworkStatsRow extends AffiliateProfileAdminRow {
  /** Sum of confirmed (PAID) deposits from this affiliate's direct referrals. */
  depositTotalCents: number;
  /** Count of this affiliate's direct referrals with User.status ACTIVE. */
  activePlayers: number;
  /** Count of CPA_FTD commission rows earned by this affiliate. */
  ftdCount: number;
  /** paidToAffiliateCents + keptByManagerCents. */
  commissionGeneratedCents: number;
  /** REVSHARE_DEPOSIT + CPA_FTD credited to the affiliate themselves. */
  paidToAffiliateCents: number;
  /** MANAGER_SPREAD credited to the manager, tagged with this affiliateId. */
  keptByManagerCents: number;
  /** depositTotalCents - commissionGeneratedCents. */
  houseProfitCents: number;
}

/** The Manager dashboard's KPI rollup — computed entirely from src/modules/affiliate's Commission/AffiliateProfile tables (read-only, via affiliateContainer), never from Wallet/Ledger. */
export interface ManagerDashboardStats {
  affiliatesActive: number;
  affiliatesPending: number;
  playersReferred: number;
  commissionTotalCents: number;
  commissionTodayCents: number;
  commission7dCents: number;
  commission30dCents: number;
}
