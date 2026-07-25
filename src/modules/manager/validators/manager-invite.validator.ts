import { z } from "zod";
import { passwordSchema } from "@/modules/identity/validators/auth.validator";

/** The Admin only generates a bare token/link — no candidate identity here (see "Cadastro de Gerente" decision). */
export const createManagerInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateManagerInviteInput = z.infer<typeof createManagerInviteSchema>;

export const adminManagerInviteListQuerySchema = z.object({
  status: z.enum(["ACTIVE", "EXPIRED", "REVOKED", "USED"]).optional(),
  approvalStatus: z.enum(["PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
  search: z.string().optional(),
});
export type AdminManagerInviteListQuery = z.infer<typeof adminManagerInviteListQuerySchema>;

/** POST .../approve — the Admin decides the manager's maximum commission ceiling right now. */
export const approveManagerInviteSchema = z.object({
  commissionPercent: z.number().min(0).max(100),
});
export type ApproveManagerInviteInput = z.infer<typeof approveManagerInviteSchema>;

export const rejectManagerInviteSchema = z.object({
  reason: z.string().trim().min(3, "Motivo obrigatório").max(2000),
});
export type RejectManagerInviteInput = z.infer<typeof rejectManagerInviteSchema>;

/** Public — the invited person supplies their own identity and sets a password to finish onboarding (see "Cadastro de Gerente" decision). */
export const acceptManagerInviteSchema = z
  .object({
    name: z.string().trim().min(2, "Nome obrigatório").max(120),
    email: z.string().trim().toLowerCase().email("Email inválido"),
    phone: z.string().trim().optional().or(z.literal("")),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { message: "As senhas não conferem", path: ["confirmPassword"] });
export type AcceptManagerInviteInput = z.infer<typeof acceptManagerInviteSchema>;
