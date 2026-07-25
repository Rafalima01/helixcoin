import type { AffiliateStatus, AffiliateLinkStatus, CommissionSourceType, CommissionStatus } from "@prisma/client";

export type { AffiliateStatus, AffiliateLinkStatus, CommissionSourceType, CommissionStatus };

/** Domain entity — a thin extension of User (role AFFILIATE). `status` gates whether the commission engine pays this user anything at all. */
export interface AffiliateProfile {
  id: string;
  userId: string;
  managerId: string | null;
  status: AffiliateStatus;
  documentsJson: Record<string, unknown> | null;
  pixKeyEncrypted: string | null;
  cpaOverrideCents: number | null;
  revShareOverridePercent: number | null;
  requestedAt: Date;
  approvedAt: Date | null;
  approvedById: string | null;
  rejectionReason: string | null;
  blockedAt: Date | null;
  blockedReason: string | null;
  linkClicks: number;
  canInviteAffiliates: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Domain entity — a named, trackable, pausable variant of an affiliate's single referralCode. Never a second attribution mechanism, see schema doc comment. */
export interface AffiliateLink {
  id: string;
  affiliateId: string;
  name: string;
  slug: string;
  status: AffiliateLinkStatus;
  clicks: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Domain entity — one commission event per level, the persisted record behind a WalletTransaction(type COMMISSION). */
export interface Commission {
  id: string;
  /** Null for a MANAGER_SPREAD row generated with no affiliate in the path (the manager's own platform link). */
  affiliateId: string | null;
  managerId: string | null;
  /** Who the wallet credit actually went to — the affiliate on REVSHARE_DEPOSIT/CPA_FTD rows, the manager on MANAGER_SPREAD rows. */
  payeeUserId: string;
  level: number;
  originUserId: string;
  sourceType: CommissionSourceType;
  triggerId: string;
  amountCents: number;
  percentApplied: number | null;
  status: CommissionStatus;
  walletTransactionId: string | null;
  unlockWalletTransactionId: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
}

/** Domain entity — single global row (id "global"). */
export interface AffiliateSettings {
  id: string;
  revShareLevel1Percent: number;
  revShareLevel2Percent: number;
  revShareLevel3Percent: number;
  cpaAmountCents: number;
  autoApproveCommissions: boolean;
  requireManagerApprovalForAffiliates: boolean;
  updatedAt: Date;
}

/** Admin/manager list row — AffiliateProfile joined with the owning user's display fields. */
export interface AffiliateProfileAdminRow extends AffiliateProfile {
  userName: string;
  userEmail: string;
  userPhone: string | null;
  managerName: string | null;
}

/** Admin/manager list row — Commission joined with the affiliate's and origin player's display fields. */
export interface CommissionAdminRow extends Commission {
  affiliateName: string;
  affiliateEmail: string;
  originUserName: string;
}
