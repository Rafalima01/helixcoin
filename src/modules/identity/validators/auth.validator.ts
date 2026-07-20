import { z } from "zod";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username deve ter ao menos 3 caracteres")
  .max(24, "Username deve ter no máximo 24 caracteres")
  .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e underscore");

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter ao menos 8 caracteres")
  .max(72, "A senha deve ter no máximo 72 caracteres");

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Informe seu nome").max(60),
    lastName: z.string().trim().min(1, "Informe seu sobrenome").max(60),
    username: usernameSchema,
    email: z.string().trim().toLowerCase().email("Email inválido"),
    password: passwordSchema,
    referralCode: z.string().trim().optional().or(z.literal("")),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Email inválido"),
    password: z.string().min(1, "Informe sua senha"),
    rememberMe: z.boolean().optional().default(false),
  })
  .strict();

/** Pre-parse shape (rememberMe optional) — what react-hook-form's defaultValues + zodResolver expect. */
export type LoginInput = z.input<typeof loginSchema>;

export { usernameSchema, passwordSchema };
