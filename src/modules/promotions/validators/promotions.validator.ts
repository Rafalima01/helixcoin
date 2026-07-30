import { z } from "zod";

/** PUT /api/admin/promotions/settings */
export const promotionSettingsUpdateSchema = z.object({
  firstDepositBonusPercent: z.number().min(0).max(1).optional(),
});
export type PromotionSettingsUpdateInput = z.infer<typeof promotionSettingsUpdateSchema>;
