import type {
  AffiliateProfile,
  AffiliateProfileAdminRow,
  AffiliateLink,
  Commission,
  CommissionAdminRow,
  AffiliateSettings,
} from "@/modules/affiliate/entities/affiliate.entity";

// ---------------------------------------------------------------------------
// Affiliate (own profile)
// ---------------------------------------------------------------------------

export interface AffiliateProfileDto {
  id: string;
  status: string;
  managerId: string | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  blockedReason: string | null;
  createdAt: string;
}

export function toAffiliateProfileDto(entity: AffiliateProfile): AffiliateProfileDto {
  return {
    id: entity.id,
    status: entity.status,
    managerId: entity.managerId,
    requestedAt: entity.requestedAt.toISOString(),
    approvedAt: entity.approvedAt ? entity.approvedAt.toISOString() : null,
    rejectionReason: entity.rejectionReason,
    blockedReason: entity.blockedReason,
    createdAt: entity.createdAt.toISOString(),
  };
}

/** The player's own profile view — adds fields only meaningful with settings/manager context resolved (not derivable from the entity alone), so it's a separate mapper rather than an extension of the base one. */
export interface AffiliateMyProfileDto extends AffiliateProfileDto {
  /** `revShareOverridePercent ?? AffiliateSettings.revShareLevel1Percent`, 0-100 — sempre calculado no backend, nunca hardcoded no front. */
  resolvedCommissionPercent: number;
  canInviteAffiliates: boolean;
  /** Só preenchido quando `managerId` existe e `canInviteAffiliates` é true — o link "Convidar Afiliados" do gerente dono desse afiliado. */
  managerInviteCode: string | null;
}

export function toAffiliateMyProfileDto(
  entity: AffiliateProfile,
  extra: { resolvedCommissionPercent: number; managerInviteCode: string | null }
): AffiliateMyProfileDto {
  return {
    ...toAffiliateProfileDto(entity),
    resolvedCommissionPercent: extra.resolvedCommissionPercent,
    canInviteAffiliates: entity.canInviteAffiliates,
    managerInviteCode: extra.managerInviteCode,
  };
}

export interface AffiliateProfileAdminDto extends AffiliateProfileDto {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string | null;
  managerName: string | null;
  approvedById: string | null;
  blockedAt: string | null;
  /** 0-100, null = using the global/level default (see AffiliateSettings). Set by a Manager via updateCommission — never above their own ceiling. */
  commissionPercent: number | null;
  canInviteAffiliates: boolean;
  updatedAt: string;
}

export function toAffiliateProfileAdminDto(row: AffiliateProfileAdminRow): AffiliateProfileAdminDto {
  return {
    ...toAffiliateProfileDto(row),
    userId: row.userId,
    userName: row.userName,
    userEmail: row.userEmail,
    userPhone: row.userPhone,
    managerName: row.managerName,
    canInviteAffiliates: row.canInviteAffiliates,
    approvedById: row.approvedById,
    blockedAt: row.blockedAt ? row.blockedAt.toISOString() : null,
    commissionPercent: row.revShareOverridePercent !== null ? Math.round(row.revShareOverridePercent * 1000) / 10 : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Admin-only performance view for a single affiliate — the "Desempenho"
 * section in the Afiliados drawer (src/app/admin/affiliates/page.tsx).
 * Built from AffiliateRawMetrics (src/modules/affiliate/services/affiliate-metrics.ts)
 * plus commercialWithdrawRepository.sumApprovedAmountCents — see
 * affiliate-admin.controller.ts's handleGetAffiliatePerformanceAdmin.
 */
export interface AffiliatePerformanceAdminDto {
  /** prisma.user.count({ referredById }) — jogadores indicados por este afiliado. */
  referredCount: number;
  /** Distinct referred users with at least one PAID deposit — true First-Time-Deposit count, NOT a count of deposits (see AffiliateRawMetrics.ftdCount's doc comment). */
  ftdCount: number;
  /** ftdCount / referredCount * 100, 0 quando referredCount é 0. */
  conversionPercent: number;
  /** Soma de Deposit.amountCents (status PAID) dos usuários indicados. */
  referredDepositTotalCents: number;
  /** Soma de TODAS as Commission (qualquer status) geradas para este afiliado — mesma definição usada no próprio dashboard do afiliado (AffiliateDashboardDto.commissionTotalCents). */
  commissionGeneratedCents: number;
  /** Soma de CommercialWithdraw.amountCents com status APPROVED, payeeRole AFFILIATE — comissão que já efetivamente saiu para o afiliado. Fonte: src/modules/commercial-withdrawals. */
  commissionPaidCents: number;
  /** max(0, balanceAvailableCents + balanceLockedCents - commissionPaidCents) — comissão real (não rejeitada) ainda não retirada. */
  commissionPendingCents: number;
  balanceAvailableCents: number;
  balanceLockedCents: number;
  linkClicks: number;
  commissionTodayCents: number;
  commission7dCents: number;
  commission30dCents: number;
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export interface AffiliateLinkDto {
  id: string;
  name: string;
  slug: string;
  status: string;
  clicks: number;
  createdAt: string;
}

export function toAffiliateLinkDto(entity: AffiliateLink): AffiliateLinkDto {
  return {
    id: entity.id,
    name: entity.name,
    slug: entity.slug,
    status: entity.status,
    clicks: entity.clicks,
    createdAt: entity.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------

export interface CommissionDto {
  id: string;
  level: number;
  sourceType: string;
  amountCents: number;
  percentApplied: number | null;
  status: string;
  createdAt: string;
  approvedAt: string | null;
}

export function toCommissionDto(entity: Commission): CommissionDto {
  return {
    id: entity.id,
    level: entity.level,
    sourceType: entity.sourceType,
    amountCents: entity.amountCents,
    percentApplied: entity.percentApplied,
    status: entity.status,
    createdAt: entity.createdAt.toISOString(),
    approvedAt: entity.approvedAt ? entity.approvedAt.toISOString() : null,
  };
}

/** Player-facing commission history (GET /api/affiliate/commissions) — enriches CommissionDto with the referred player's name and the original deposit amount, both already available via commissionRepository.listAdmin's join, just discarded by toCommissionDto. Never exposed to admin/manager routes (those keep their own richer/narrower DTOs). */
export interface CommissionHistoryDto extends CommissionDto {
  playerName: string;
  /** `amountCents / percentApplied` quando percentApplied existe — o valor do depósito que gerou a comissão, não armazenado diretamente no schema. */
  depositAmountCents: number | null;
}

export function toCommissionHistoryDto(row: CommissionAdminRow): CommissionHistoryDto {
  return {
    ...toCommissionDto(row),
    playerName: row.originUserName,
    depositAmountCents: row.percentApplied ? Math.round(row.amountCents / row.percentApplied) : null,
  };
}

export interface CommissionAdminDto extends CommissionDto {
  /** Null for a MANAGER_SPREAD row with no affiliate in the path — see affiliateName/affiliateEmail, which fall back to the manager (the payee) in that case. */
  affiliateId: string | null;
  affiliateName: string;
  affiliateEmail: string;
  managerId: string | null;
  originUserId: string;
  originUserName: string;
  triggerId: string;
  rejectionReason: string | null;
}

export function toCommissionAdminDto(row: CommissionAdminRow): CommissionAdminDto {
  return {
    ...toCommissionDto(row),
    affiliateId: row.affiliateId,
    affiliateName: row.affiliateName,
    affiliateEmail: row.affiliateEmail,
    managerId: row.managerId,
    originUserId: row.originUserId,
    originUserName: row.originUserName,
    triggerId: row.triggerId,
    rejectionReason: row.rejectionReason,
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface AffiliateSettingsDto {
  id: string;
  revShareLevel1Percent: number;
  revShareLevel2Percent: number;
  revShareLevel3Percent: number;
  autoApproveCommissions: boolean;
  requireManagerApprovalForAffiliates: boolean;
  updatedAt: string;
}

export function toAffiliateSettingsDto(entity: AffiliateSettings): AffiliateSettingsDto {
  return {
    id: entity.id,
    revShareLevel1Percent: entity.revShareLevel1Percent,
    revShareLevel2Percent: entity.revShareLevel2Percent,
    revShareLevel3Percent: entity.revShareLevel3Percent,
    autoApproveCommissions: entity.autoApproveCommissions,
    requireManagerApprovalForAffiliates: entity.requireManagerApprovalForAffiliates,
    updatedAt: entity.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Dashboard (aggregated KPIs — built directly by the service, not from a single entity)
// ---------------------------------------------------------------------------

/**
 * Powers the self-service "Indique e Ganhe" screen for EVERY logged-in
 * player — not just users an admin promoted to AffiliateProfile
 * ("Transformar em afiliado"). Referral identity (referralCode/referredById,
 * see auth.service.ts's register()) has always been independent of
 * AffiliateProfile; this DTO is what makes that split explicit end to end.
 * A user with no AffiliateProfile gets real, non-zero `referredCount`/
 * `referredDepositTotalCents` (their referral network is real) but
 * structurally zero commission figures (they were never approved to earn
 * one) and `resolvedCommissionPercent` falling back to the platform default.
 */
export interface AffiliateDashboardDto {
  commissionTotalCents: number;
  commissionTodayCents: number;
  commission7dCents: number;
  commission30dCents: number;
  balanceAvailableCents: number;
  balanceLockedCents: number;
  /** Jogadores indicados — prisma.user.count({ referredById: userId }). Independent of AffiliateProfile. */
  referredCount: number;
  /** Depósitos confirmados — depósitos distintos que geraram comissão de nível 1 para este afiliado. Sempre 0 sem AffiliateProfile. */
  confirmedDeposits: number;
  /** confirmedDeposits / referredCount * 100, 0 quando referredCount é 0. */
  conversionPercent: number;
  linkClicks: number;
  /** Soma de Deposit.amountCents (status PAID) dos usuários com referredById = este usuário — volume bruto depositado pela rede, não o valor da comissão. Independent of AffiliateProfile. */
  referredDepositTotalCents: number;
  /** `revShareOverridePercent ?? AffiliateSettings.revShareLevel1Percent`, 0-100 — o mesmo default (5%) que todo usuário vê antes de qualquer promoção administrativa. Sempre calculado no backend. */
  resolvedCommissionPercent: number;
  /** AffiliateProfile.managerId, ou null quando não há AffiliateProfile — gate para o efeito de atribuição de gerente por link ("Convidar Afiliados"), que só se aplica a um afiliado administrativo de verdade. */
  managerId: string | null;
}
