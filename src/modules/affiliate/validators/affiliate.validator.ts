import { z } from "zod";

// ---------------------------------------------------------------------------
// Affiliate (player-facing)
// ---------------------------------------------------------------------------

/** POST /api/affiliate/apply — `managerCode` resolves to ManagerProfile.inviteCode when present; otherwise the application is left unassigned for admin manual assignment. */
export const applyAffiliateSchema = z.object({
  managerCode: z.string().trim().optional(),
  pixKey: z.string().trim().min(3).optional(),
});
export type ApplyAffiliateInput = z.infer<typeof applyAffiliateSchema>;

/** POST /api/affiliate/manager — first-touch attribution, see AffiliateService.assignManagerIfUnset. */
export const assignAffiliateManagerSchema = z.object({
  managerCode: z.string().trim().min(1, "Código do gerente obrigatório"),
});
export type AssignAffiliateManagerInput = z.infer<typeof assignAffiliateManagerSchema>;

export const createAffiliateLinkSchema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório").max(60),
});
export type CreateAffiliateLinkInput = z.infer<typeof createAffiliateLinkSchema>;

export const updateAffiliateLinkSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
});
export type UpdateAffiliateLinkInput = z.infer<typeof updateAffiliateLinkSchema>;

// ---------------------------------------------------------------------------
// Admin / Manager decisions
// ---------------------------------------------------------------------------

const decisionActionSchema = z.enum(["APPROVE", "REJECT", "BLOCK", "REQUEST_DOCUMENTS"]);

/** Reason is mandatory for every action except APPROVE — "Nunca alterar status silenciosamente." */
export const decideAffiliateApplicationSchema = z
  .object({
    action: decisionActionSchema,
    reason: z.string().trim().min(3).optional(),
    managerId: z.string().optional(),
  })
  .refine((v) => v.action === "APPROVE" || !!v.reason, {
    message: "Motivo obrigatório para esta ação",
    path: ["reason"],
  });
export type DecideAffiliateApplicationInput = z.infer<typeof decideAffiliateApplicationSchema>;

/** PATCH /api/admin/affiliate/applications/{id}/commission — same 0-100 bound as manager.validator.ts's commissionPercent (percentage-only platform, see AffiliateService.updateCommission). */
export const updateAffiliateCommissionSchema = z.object({
  percent: z.number().min(0).max(100),
});
export type UpdateAffiliateCommissionInput = z.infer<typeof updateAffiliateCommissionSchema>;

/** POST /api/admin/affiliate/applications — Admin finds a regular user (by id) and turns them into a direct affiliate (no manager). See AffiliateService.adminCreateDirect. */
export const createDirectAffiliateSchema = z.object({
  userId: z.string().trim().min(1, "userId obrigatório"),
});
export type CreateDirectAffiliateInput = z.infer<typeof createDirectAffiliateSchema>;

export const decideCommissionSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().min(3).optional(),
  })
  .refine((v) => v.action !== "REJECT" || !!v.reason, {
    message: "Motivo da rejeição é obrigatório",
    path: ["reason"],
  });
export type DecideCommissionInput = z.infer<typeof decideCommissionSchema>;

export const affiliateSettingsUpdateSchema = z.object({
  revShareLevel1Percent: z.number().min(0).max(1).optional(),
  revShareLevel2Percent: z.number().min(0).max(1).optional(),
  revShareLevel3Percent: z.number().min(0).max(1).optional(),
  autoApproveCommissions: z.boolean().optional(),
  requireManagerApprovalForAffiliates: z.boolean().optional(),
});
export type AffiliateSettingsUpdateInput = z.infer<typeof affiliateSettingsUpdateSchema>;

// ---------------------------------------------------------------------------
// Admin/manager list queries
// ---------------------------------------------------------------------------

export const adminAffiliateListQuerySchema = z.object({
  status: z.string().optional(),
  managerId: z.string().optional(),
  search: z.string().optional(),
});
export type AdminAffiliateListQuery = z.infer<typeof adminAffiliateListQuerySchema>;

export const adminCommissionListQuerySchema = z.object({
  affiliateId: z.string().optional(),
  managerId: z.string().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AdminCommissionListQuery = z.infer<typeof adminCommissionListQuerySchema>;
