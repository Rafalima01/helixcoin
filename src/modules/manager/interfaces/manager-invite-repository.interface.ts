import type {
  ManagerInvite,
  ManagerInviteAdminRow,
  ManagerInviteStatus,
  ManagerApprovalStatus,
} from "@/modules/manager/entities/manager-invite.entity";

/** No candidate identity here anymore — the Admin only generates a bare token/link (see "Cadastro de Gerente" decision). */
export interface CreateManagerInviteInput {
  tokenHash: string;
  expiresAt: Date | null;
  createdById: string;
}

/** What the candidate submits to redeem the invite — persisted onto the row so the Admin's Solicitações queue can display it. */
export interface AcceptedCandidateInfo {
  name: string;
  email: string;
  phone: string | null;
}

export interface ManagerInviteListFilter {
  status?: ManagerInviteStatus;
  approvalStatus?: ManagerApprovalStatus;
  search?: string;
  page: number;
  pageSize: number;
}

export interface IManagerInviteRepository {
  create(input: CreateManagerInviteInput): Promise<ManagerInvite>;
  findById(id: string): Promise<ManagerInvite | null>;
  findByTokenHash(tokenHash: string): Promise<ManagerInvite | null>;
  findByIdAdmin(id: string): Promise<ManagerInviteAdminRow | null>;
  listAdmin(filter: ManagerInviteListFilter): Promise<{ items: ManagerInviteAdminRow[]; total: number }>;
  /** Regenerate — replaces tokenHash/expiresAt, resets status to ACTIVE. */
  rotateToken(id: string, tokenHash: string, expiresAt: Date | null): Promise<ManagerInvite>;
  /** USED + approvalStatus PENDING_REVIEW — the account was created but is not a Manager yet. Also persists the candidate-supplied name/email/phone onto the row. */
  markAcceptedPendingReview(
    id: string,
    userId: string,
    candidate: AcceptedCandidateInfo,
    ip: string | null,
    userAgent: string | null
  ): Promise<ManagerInvite>;
  markApproved(id: string, commissionPercent: number, approvedById: string): Promise<ManagerInvite>;
  markRejected(id: string, reason: string, rejectedById: string): Promise<ManagerInvite>;
  markRevoked(id: string, revokedById: string): Promise<ManagerInvite>;
}
