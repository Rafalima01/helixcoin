import { z } from "zod";

export const adminManagerListQuerySchema = z.object({
  search: z.string().optional(),
});
export type AdminManagerListQuery = z.infer<typeof adminManagerListQuerySchema>;

/** Admin edits a Manager's commission percentage after onboarding — see manager.service.ts's updateCommission(). */
export const updateManagerCommissionSchema = z.object({
  commissionPercent: z.number().min(0).max(100),
});
export type UpdateManagerCommissionInput = z.infer<typeof updateManagerCommissionSchema>;

/** A Manager sets one of their network affiliates' commission — ceiling-checked server-side against ManagerProfile.commissionPercent, see AffiliateService.updateCommission. */
export const updateNetworkAffiliateCommissionSchema = z.object({
  percent: z.number().min(0).max(100),
});
export type UpdateNetworkAffiliateCommissionInput = z.infer<typeof updateNetworkAffiliateCommissionSchema>;

/** A Manager grants/revokes a network affiliate's ability to recruit sub-affiliates via the manager's own invite link — see AffiliateService.setCanInviteAffiliates. */
export const updateNetworkAffiliateInvitePermissionSchema = z.object({
  canInviteAffiliates: z.boolean(),
});
export type UpdateNetworkAffiliateInvitePermissionInput = z.infer<typeof updateNetworkAffiliateInvitePermissionSchema>;
