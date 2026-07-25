/** Extension points, same "publish now, consumers subscribe independently" convention as WALLET_EVENTS/PAYMENT_EVENTS. NotificationService is the first real subscriber (see src/modules/affiliate/services). */
export const AFFILIATE_EVENTS = {
  created: "affiliate.created",
  approved: "affiliate.approved",
  rejected: "affiliate.rejected",
  blocked: "affiliate.blocked",
  documentsRequested: "affiliate.documents_requested",
  referralRegistered: "affiliate.referral_registered",
  firstDeposit: "affiliate.first_deposit",
  commissionGenerated: "affiliate.commission_generated",
  commissionApproved: "affiliate.commission_approved",
  commissionRejected: "affiliate.commission_rejected",
  /** Fired by affiliate.service.ts (apply() via managerCode, or assignManager()) — the actual write to AffiliateProfile.managerId happens here, not in src/modules/manager, since manager depends on affiliate and not the reverse. */
  managerAssigned: "affiliate.manager_assigned",
} as const;

export interface AffiliateStatusEventPayload {
  affiliateId: string;
  userId: string;
  status: string;
  managerId: string | null;
}

export interface ReferralRegisteredEventPayload {
  newUserId: string;
  referrerUserId: string;
  affiliateLinkId: string | null;
}

export interface FirstDepositEventPayload {
  userId: string;
  depositId: string;
  amountCents: number;
}

export interface CommissionEventPayload {
  commissionId: string;
  /** Null for a MANAGER_SPREAD row generated with no affiliate in the path (the manager's own platform link). */
  affiliateId: string | null;
  affiliateUserId: string;
  level: number;
  amountCents: number;
  status: string;
}
