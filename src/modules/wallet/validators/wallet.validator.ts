import { z } from "zod";

/** Manual credit/debit — reason + observation are mandatory, never a silent balance change. */
export const adminAdjustSchema = z.object({
  /** Positive = credit, negative = debit. */
  amount: z.number().refine((v) => v !== 0, "Valor não pode ser zero"),
  account: z.enum(["MAIN", "LOCKED", "BONUS"]).default("MAIN"),
  reason: z.string().trim().min(3, "Motivo obrigatório"),
  observation: z.string().trim().min(3, "Observação obrigatória"),
});
export type AdminAdjustInput = z.infer<typeof adminAdjustSchema>;

/** Pagination itself is parsed separately via src/server/http's parsePagination — this only covers the filter/search fields. */
export const adminWalletListQuerySchema = z.object({
  search: z.string().optional(),
});
export type AdminWalletListQuery = z.infer<typeof adminWalletListQuerySchema>;

export const adminTransactionListQuerySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  userId: z.string().optional(),
  origin: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
});
export type AdminTransactionListQuery = z.infer<typeof adminTransactionListQuerySchema>;
