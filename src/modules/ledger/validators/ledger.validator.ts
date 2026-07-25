import { z } from "zod";

/** Pagination itself is parsed separately via src/server/http's parsePagination — this only covers the filter fields. */
export const adminLedgerListQuerySchema = z.object({
  debitAccount: z.string().optional(),
  creditAccount: z.string().optional(),
  reference: z.string().optional(),
  referenceType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});
export type AdminLedgerListQuery = z.infer<typeof adminLedgerListQuerySchema>;
