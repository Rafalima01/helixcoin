import type { ManagerInvite, ManagerInviteAdminRow } from "@/modules/manager/entities/manager-invite.entity";

/** Admin-facing — never includes tokenHash. The raw, redeemable link only ever appears in CreateManagerInviteResultDto. `name`/`email`/`phone` are null until the candidate accepts the invite. */
export interface ManagerInviteAdminDto {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: string;
  expiresAt: string | null;
  createdById: string;
  createdByName: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  acceptedIp: string | null;
  acceptedUserAgent: string | null;
  approvalStatus: string | null;
  approvedCommissionPercent: number | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  revokedAt: string | null;
  revokedById: string | null;
  revokedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toManagerInviteAdminDto(row: ManagerInviteAdminRow): ManagerInviteAdminDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    status: row.status,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdById: row.createdById,
    createdByName: row.createdByName,
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    acceptedByUserId: row.acceptedByUserId,
    acceptedIp: row.acceptedIp,
    acceptedUserAgent: row.acceptedUserAgent,
    approvalStatus: row.approvalStatus,
    approvedCommissionPercent: row.approvedCommissionPercent,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    approvedByName: row.approvedByName,
    rejectedAt: row.rejectedAt ? row.rejectedAt.toISOString() : null,
    rejectedByName: row.rejectedByName,
    rejectionReason: row.rejectionReason,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    revokedById: row.revokedById,
    revokedByName: row.revokedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Safe subset shown on the public /manager-invite/{token} acceptance page — the candidate hasn't submitted their identity yet at this point (see "Cadastro de Gerente" decision), so this only signals whether the token is still redeemable; the page renders the Nome/E-mail/Telefone/Senha form itself. */
export interface ManagerInvitePublicDto {
  status: string;
}

export function toManagerInvitePublicDto(entity: ManagerInvite): ManagerInvitePublicDto {
  return { status: entity.status };
}

/** create()/regenerate()'s one-time response — the ONLY place the raw, redeemable link is ever returned. */
export interface CreateManagerInviteResultDto {
  invite: ManagerInviteAdminDto;
  inviteLink: string;
}
