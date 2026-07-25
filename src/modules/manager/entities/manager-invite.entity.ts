import type { ManagerProfileStatus } from "@/modules/manager/entities/manager.entity";

export type ManagerInviteStatus = "ACTIVE" | "EXPIRED" | "REVOKED" | "USED";

/**
 * The Admin's verdict on an accepted invite. Null until accepted; set to
 * PENDING_REVIEW the moment the invited person finishes signup (see
 * ManagerInviteService.accept) — the account exists as a plain USER at that
 * point, not yet a Manager. Feeds the Comercial → Gerentes → Solicitações
 * queue.
 */
export type ManagerApprovalStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";

/**
 * Admin-issued, single-use onboarding invite — the ONLY way a User becomes a
 * Manager (see ManagerInviteService.accept/approve). `tokenHash` follows the
 * same "never persist the raw secret" convention as PasswordResetToken/
 * EmailVerificationToken (src/modules/identity) — the raw token is returned
 * once, at create/regenerate time, and is unrecoverable afterward.
 *
 * `commissionPercent`/`initialStatus` are historical — the "Refinamento Fase
 * 8" flow moved those decisions to approval time (see
 * `approvedCommissionPercent`); new invites no longer set them.
 *
 * `name`/`email`/`phone` are null until accepted — the Admin only generates
 * a bare token/link (see "Cadastro de Gerente" decision); the candidate
 * supplies their own identity when they redeem it (ManagerInviteService.accept).
 */
export interface ManagerInvite {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  /** @deprecated Historical only — see module doc comment above. */
  commissionPercent: number;
  /** @deprecated Historical only — see module doc comment above. */
  initialStatus: ManagerProfileStatus;
  /** Never exposed via any DTO — see the module doc comment above. */
  tokenHash: string;
  status: ManagerInviteStatus;
  expiresAt: Date | null;
  createdById: string;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  acceptedIp: string | null;
  acceptedUserAgent: string | null;
  approvalStatus: ManagerApprovalStatus | null;
  approvedCommissionPercent: number | null;
  approvedAt: Date | null;
  approvedById: string | null;
  rejectedAt: Date | null;
  rejectedById: string | null;
  rejectionReason: string | null;
  revokedAt: Date | null;
  revokedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Admin list/detail row — ManagerInvite joined with the creator/revoker/approver/rejecter's display names. */
export interface ManagerInviteAdminRow extends ManagerInvite {
  createdByName: string;
  revokedByName: string | null;
  approvedByName: string | null;
  rejectedByName: string | null;
}
