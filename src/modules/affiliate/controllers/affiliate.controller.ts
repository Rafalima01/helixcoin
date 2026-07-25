import type { NextRequest } from "next/server";
import { ok, created, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { NotFoundError } from "@/server/errors";
// Direct read, same precedent as affiliate.service.ts's apply() — resolving
// a manager's inviteCode has no natural home in this module's own
// repository interfaces, not worth a cross-module dependency for.
import { prisma } from "@/lib/prisma";
import { affiliateContainer } from "@/modules/affiliate/container";
import {
  applyAffiliateSchema,
  createAffiliateLinkSchema,
  updateAffiliateLinkSchema,
} from "@/modules/affiliate/validators/affiliate.validator";
import {
  toAffiliateProfileDto,
  toAffiliateMyProfileDto,
  toAffiliateLinkDto,
  toCommissionHistoryDto,
} from "@/modules/affiliate/dto/affiliate.dto";

const { affiliateService, affiliateLinkService, commissionRepository } = affiliateContainer;

/** `revShareOverridePercent`/`revShareLevel1Percent` are stored as 0-1 fractions — same convention as toAffiliateProfileAdminDto's `commissionPercent`. */
function resolveCommissionPercent(overridePercent: number | null, defaultPercent: number): number {
  return Math.round((overridePercent ?? defaultPercent) * 1000) / 10;
}

/**
 * Thin HTTP adapters — validate → call the affiliate module's services →
 * shape the response. No commission math or Wallet access here; that's
 * exclusively commission.service.ts's job.
 */
export async function handleApplyAffiliate(req: NextRequest, auth: AuthContext) {
  const body = applyAffiliateSchema.parse(await req.json().catch(() => ({})));
  const profile = await affiliateService.apply(auth.userId, body);
  return created(toAffiliateProfileDto(profile));
}

/** Returns `null` (200) rather than 404 when the user has no affiliate profile yet — the player-facing panel branches its own UI on this (sem perfil vs. pendente vs. aprovado), so a thrown error would collapse all three into one client-side error state. */
export async function handleGetMyAffiliateProfile(_req: NextRequest, auth: AuthContext) {
  const profile = await affiliateService.getProfile(auth.userId).catch(() => null);
  if (!profile) return ok(null);
  const settings = await affiliateService.getSettings();

  let managerInviteCode: string | null = null;
  if (profile.managerId && profile.canInviteAffiliates) {
    const manager = await prisma.managerProfile.findUnique({ where: { id: profile.managerId }, select: { inviteCode: true } });
    managerInviteCode = manager?.inviteCode ?? null;
  }

  return ok(
    toAffiliateMyProfileDto(profile, {
      resolvedCommissionPercent: resolveCommissionPercent(profile.revShareOverridePercent, settings.revShareLevel1Percent),
      managerInviteCode,
    })
  );
}

export async function handleGetAffiliateDashboard(_req: NextRequest, auth: AuthContext) {
  const profile = await affiliateService.getProfile(auth.userId);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [total, today, last7d, last30d, available, locked, referredCount, confirmedDeposits] = await Promise.all([
    commissionRepository.sumAmountCents({ affiliateId: profile.id }),
    commissionRepository.sumAmountCents({ affiliateId: profile.id, from: startOfToday }),
    commissionRepository.sumAmountCents({ affiliateId: profile.id, from: sevenDaysAgo }),
    commissionRepository.sumAmountCents({ affiliateId: profile.id, from: thirtyDaysAgo }),
    commissionRepository.sumAmountCents({ affiliateId: profile.id, status: "AVAILABLE" }),
    commissionRepository.sumAmountCents({ affiliateId: profile.id, status: "LOCKED" }),
    prisma.user.count({ where: { referredById: auth.userId } }),
    commissionRepository.countConfirmedDeposits(profile.id),
  ]);

  return ok({
    commissionTotalCents: total,
    commissionTodayCents: today,
    commission7dCents: last7d,
    commission30dCents: last30d,
    balanceAvailableCents: available,
    balanceLockedCents: locked,
    referredCount,
    confirmedDeposits,
    conversionPercent: referredCount > 0 ? Math.round((confirmedDeposits / referredCount) * 1000) / 10 : 0,
    linkClicks: profile.linkClicks,
  });
}

export async function handleListMyLinks(_req: NextRequest, auth: AuthContext) {
  const profile = await affiliateService.getProfile(auth.userId);
  const links = await affiliateLinkService.listForAffiliate(profile.id);
  return ok(links.map(toAffiliateLinkDto));
}

export async function handleCreateMyLink(req: NextRequest, auth: AuthContext) {
  const profile = await affiliateService.getProfile(auth.userId);
  const body = createAffiliateLinkSchema.parse(await req.json());
  const link = await affiliateLinkService.create(profile.id, body.name);
  return created(toAffiliateLinkDto(link));
}

export async function handleUpdateMyLink(req: NextRequest, auth: AuthContext, linkId: string) {
  const profile = await affiliateService.getProfile(auth.userId);
  const body = updateAffiliateLinkSchema.parse(await req.json());
  if (!body.status) throw new NotFoundError("Nada para atualizar");
  const link = await affiliateLinkService.setStatus(linkId, profile.id, body.status);
  return ok(toAffiliateLinkDto(link));
}

export async function handleDeleteMyLink(_req: NextRequest, auth: AuthContext, linkId: string) {
  const profile = await affiliateService.getProfile(auth.userId);
  await affiliateLinkService.delete(linkId, profile.id);
  return ok({ deleted: true });
}

export async function handleListMyCommissions(req: NextRequest, auth: AuthContext) {
  const profile = await affiliateService.getProfile(auth.userId);
  const pagination = parsePagination(req.nextUrl.searchParams);
  const { items, total } = await commissionRepository.listAdmin({
    affiliateId: profile.id,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  return ok(items.map(toCommissionHistoryDto), buildPaginationMeta(pagination, total));
}
