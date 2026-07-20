import { z } from "zod";

// signupSchema/loginSchema live in @/modules/identity/validators/auth.validator
// now — the identity module is the sole source of auth, including validation.

export const depositSchema = z.object({
  amount: z.number().min(5, "Valor mínimo de R$ 5,00").max(50000, "Valor máximo de R$ 50.000,00"),
});
export type DepositInput = z.infer<typeof depositSchema>;

export const withdrawSchema = z.object({
  amount: z.number().min(10, "Valor mínimo de R$ 10,00"),
  pixKey: z.string().trim().min(3, "Informe uma chave PIX válida"),
});
export type WithdrawInput = z.infer<typeof withdrawSchema>;

export const betSchema = z.object({
  amount: z.number().min(1, "Valor mínimo de R$ 1,00").max(20000, "Valor máximo de R$ 20.000,00"),
});
export type BetInput = z.infer<typeof betSchema>;
