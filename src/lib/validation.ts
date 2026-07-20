import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome completo").max(80),
    email: z.string().trim().email("Email inválido"),
    password: z.string().min(6, "Mínimo de 6 caracteres").max(72, "Máximo de 72 caracteres"),
    referralCode: z.string().trim().optional().or(z.literal("")),
    terms: z.boolean().refine((v) => v === true, {
      message: "Você precisa aceitar os termos para continuar",
    }),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Email inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

export type LoginInput = z.infer<typeof loginSchema>;

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
