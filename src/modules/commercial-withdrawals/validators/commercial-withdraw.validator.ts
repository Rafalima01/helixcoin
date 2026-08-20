import { z } from "zod";

// Same enum as payments' pixKeyTypeSchema (src/modules/payments/validators/payments.validator.ts)
// — duplicated rather than imported since this module deliberately has no
// dependency on src/modules/payments (separate, gateway-free flow).
export const pixKeyTypeSchema = z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"]);

/** POST /api/{affiliate|manager}/pix-keys */
export const createPixKeySchema = z.object({
  type: pixKeyTypeSchema,
  key: z.string().trim().min(3, "Informe uma chave PIX válida"),
  holderCpf: z.string().trim().length(11, "CPF do titular deve ter 11 dígitos"),
});
export type CreatePixKeyInput = z.infer<typeof createPixKeySchema>;

/** PATCH /api/{affiliate|manager}/pix-keys/{id} */
export const updatePixKeySchema = createPixKeySchema.partial();
export type UpdatePixKeyInput = z.infer<typeof updatePixKeySchema>;

/** POST /api/{affiliate|manager}/withdrawals — amount is reais, converted to cents in the controller (same convention as payments' requestWithdrawSchema). */
export const requestCommercialWithdrawSchema = z.object({
  amount: z.number().positive("Valor deve ser positivo"),
  pixKeyId: z.string().uuid("Chave PIX inválida"),
});
export type RequestCommercialWithdrawInput = z.infer<typeof requestCommercialWithdrawSchema>;

/** POST /api/admin/commercial-withdrawals/{id}/decide — mirrors payments' adminWithdrawDecisionSchema exactly (rejectionReason required only for REJECT). */
export const adminCommercialWithdrawDecisionSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    rejectionReason: z.string().trim().min(3).optional(),
  })
  .refine((v) => v.action !== "REJECT" || !!v.rejectionReason, {
    message: "Motivo da rejeição é obrigatório",
    path: ["rejectionReason"],
  });
export type AdminCommercialWithdrawDecisionInput = z.infer<typeof adminCommercialWithdrawDecisionSchema>;

/** "Vínculo" admin filter — DIRECT/MANAGED only ever apply to payeeRole AFFILIATE (see commercial-withdraw.controller.ts's resolveBondUserIds); a MANAGER row has no managerId concept at all. */
export const commercialWithdrawBondSchema = z.enum(["DIRECT", "MANAGED"]);

export const adminCommercialWithdrawListQuerySchema = z.object({
  status: z.string().optional(),
  payeeRole: z.string().optional(),
  userId: z.string().optional(),
  bond: commercialWithdrawBondSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type AdminCommercialWithdrawListQuery = z.infer<typeof adminCommercialWithdrawListQuerySchema>;

/** GET /api/admin/commercial-withdrawals/summary — same filters as the list, minus status/pagination (see CommercialWithdrawSummaryFilter). */
export const adminCommercialWithdrawSummaryQuerySchema = z.object({
  payeeRole: z.string().optional(),
  bond: commercialWithdrawBondSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type AdminCommercialWithdrawSummaryQuery = z.infer<typeof adminCommercialWithdrawSummaryQuerySchema>;
