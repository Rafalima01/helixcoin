import { z } from "zod";

// signupSchema/loginSchema live in @/modules/identity/validators/auth.validator
// now — the identity module is the sole source of auth, including validation.

// depositSchema/withdrawSchema removed in Phase 7 — deposit/withdraw request
// validation now lives in @/modules/payments/validators/payments.validator
// (createDepositSchema/requestWithdrawSchema), alongside the module that
// actually owns the flow.

export const betSchema = z.object({
  amount: z.number().min(1, "Valor mínimo de R$ 1,00").max(20000, "Valor máximo de R$ 20.000,00"),
});
export type BetInput = z.infer<typeof betSchema>;
