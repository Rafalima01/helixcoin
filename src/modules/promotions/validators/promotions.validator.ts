import { z } from "zod";

const depositQuickAmountSchema = z.object({
  amountCents: z.number().int().min(1, "Valor deve ser positivo"),
  enabled: z.boolean(),
  highlightEnabled: z.boolean(),
  highlightLabel: z.string().trim().max(40).nullable(),
});
export type DepositQuickAmountInput = z.infer<typeof depositQuickAmountSchema>;

/** PUT /api/admin/promotions/settings */
export const promotionSettingsUpdateSchema = z.object({
  firstDepositBonusPercent: z.number().min(0).max(1).optional(),
  secondDepositBonusPercent: z.number().min(0).max(1).optional(),
  depositPromoEnabled: z.boolean().optional(),
  /** 30s–3600s (1h) — a countdown outside this range isn't a "quick offer" anymore, either way. */
  depositPromoDurationSeconds: z.number().int().min(30).max(3600).optional(),
  depositQuickAmounts: z
    .array(depositQuickAmountSchema)
    .min(1, "Informe ao menos um valor rápido de depósito")
    .max(8, "No máximo 8 valores rápidos de depósito")
    .refine(
      (items) => new Set(items.map((i) => i.amountCents)).size === items.length,
      "Valores duplicados não são permitidos"
    )
    .optional(),
});
export type PromotionSettingsUpdateInput = z.infer<typeof promotionSettingsUpdateSchema>;
