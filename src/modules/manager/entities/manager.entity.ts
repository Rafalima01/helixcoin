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
 * "Minha Rede" row — AffiliateProfileAdminRow plus the network rollup the
 * manager needs per affiliate. Every field here is derived from the
 * EXISTING Deposit/User/Commission tables (see ManagerService.getNetworkWithStats)
 * — nothing new is stored. Deliberately excludes anything that would let a
 * Manager infer the house's own margin (no "comissão gerada"/"lucro da
 * casa" style field) — a Manager sees only their own network's numbers.
 */
export interface AffiliateNetworkStatsRow extends AffiliateProfileAdminRow {
  /** Total users with User.referredById == this affiliate's userId — every direct signup through their link, regardless of deposit/status. */
  playersReferredCount: number;
  /** Count of CPA_FTD commission rows earned by this affiliate. */
  ftdCount: number;
  /** Sum of confirmed (PAID) deposits from this affiliate's direct referrals. */
  depositTotalCents: number;
  /** REVSHARE_DEPOSIT + CPA_FTD credited to the affiliate themselves. */
  paidToAffiliateCents: number;
  /** MANAGER_SPREAD credited to the manager, tagged with this affiliateId. */
  keptByManagerCents: number;
}

/**
 * The Manager dashboard's KPI rollup — computed entirely from
 * src/modules/affiliate's Commission/AffiliateProfile tables (read-only,
 * via affiliateContainer), never from Wallet/Ledger. Deliberately split
 * into "paid to affiliates" vs "kept by manager" per period, rather than
 * one blended "commission total" — a blended total equals
 * deposits × the manager's own ceiling, which combined with the deposit
 * totals already visible in "Minha Rede" would let a Manager back out the
 * house's own margin. Same reasoning as AffiliateNetworkStatsRow.
 */
export interface ManagerDashboardStats {
  affiliatesActive: number;
  affiliatesPending: number;
  playersReferred: number;
  paidToAffiliatesTodayCents: number;
  keptByManagerTodayCents: number;
  paidToAffiliates7dCents: number;
  keptByManager7dCents: number;
  paidToAffiliates30dCents: number;
  keptByManager30dCents: number;
  paidToAffiliatesTotalCents: number;
  keptByManagerTotalCents: number;
}
