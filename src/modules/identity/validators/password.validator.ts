import { z } from "zod";
import { passwordSchema } from "@/modules/identity/validators/auth.validator";

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe sua senha atual"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
    revokeOtherSessions: z.boolean().optional().default(false),
  })
  .strict()
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "A confirmação não confere com a nova senha",
    path: ["confirmPassword"],
  });

export const requestPasswordResetSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email inválido"),
  })
  .strict();

export const confirmPasswordResetSchema = z
  .object({
    token: z.string().min(1, "Token inválido"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "A confirmação não confere com a nova senha",
    path: ["confirmPassword"],
  });
