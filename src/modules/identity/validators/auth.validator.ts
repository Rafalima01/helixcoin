import { z } from "zod";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { isValidBrazilianPhone } from "@/lib/phone";

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

/** Required at signup — the payment gateway (AmploPay) rejects PIX deposits without a payer CPF, so collecting it upfront avoids a dead end at first deposit. Normalized to digits-only before storage/gateway calls. */
const cpfSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((v) => isValidCpf(v), "CPF inválido");

/** The player's login identifier (see AuthService.login()) — username/email are no longer collected at signup, only auto-generated internally. Normalized to digits-only before storage. */
const phoneSchema = z
  .string()
  .trim()
  .transform(onlyDigits)
  .refine((v) => isValidBrazilianPhone(v), "Telefone inválido");

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Informe seu nome").max(60),
    lastName: z.string().trim().min(1, "Informe seu sobrenome").max(60),
    phone: phoneSchema,
    password: passwordSchema,
    cpf: cpfSchema,
    referralCode: z.string().trim().optional().or(z.literal("")),
    affiliateLinkSlug: z.string().trim().optional().or(z.literal("")),
    /** ManagerProfile.inviteCode from /affiliate-invite/{code} — see AuthController.handleRegister's assignManagerIfUnset() call. Independent of referralCode: a signup can carry both, neither, or just one. */
    managerCode: z.string().trim().optional().or(z.literal("")),
    /** ?source= at signup — "demo" flags eligibility for the first-deposit bonus (see promotions.service.ts). */
    source: z.enum(["demo"]).optional(),
  })
  .strict();

/**
 * Same field (`email`) and shape for both — the wire format/backend
 * validation never changes. Only the empty-field message differs, since the
 * two zones show the player a genuinely different identifier: admin/manager
 * staff log in with email, every player (including Contas Demo) logs in
 * with phone (see AuthService.login()'s "@" branch, and login-form.tsx's
 * `identityMode` prop, which picks between these two at the UI layer).
 */
function buildLoginSchema(identifierMessage: string) {
  return z
    .object({
      email: z.string().trim().toLowerCase().min(3, identifierMessage),
      password: z.string().min(1, "Informe sua senha"),
      rememberMe: z.boolean().optional().default(false),
    })
    .strict();
}

/** Default — admin/manager staff (email identifier). Also what the backend controller parses with, since the identifier's actual format is validated server-side regardless of which message a given zone showed. */
export const loginSchema = buildLoginSchema("Informe seu email ou login");
/** Player zone (/login) — phone identifier, see login-form.tsx's `identityMode="phone"`. */
export const phoneLoginSchema = buildLoginSchema("Informe seu número de telefone");

/** Pre-parse shape (rememberMe optional) — what react-hook-form's defaultValues + zodResolver expect. */
export type LoginInput = z.input<typeof loginSchema>;

export { usernameSchema, passwordSchema };
