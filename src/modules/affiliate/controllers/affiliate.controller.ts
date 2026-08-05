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
  assignAffiliateManagerSchema,
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

/**
 * Every player is auto-enrolled as an APPROVED affiliate at signup (see
 * AffiliateService.autoEnroll) — this self-heals any account created before
 * that existed, so `data` is effectively never `null` in practice. The
 * return type keeps the `| null` union anyway since it costs nothing and
 * protects the frontend if enrollment ever genuinely fails.
 */
export async function handleGetMyAffiliateProfile(_req: NextRequest, auth: AuthContext) {
  let profile = await affiliateService.getProfile(auth.userId).catch(() => null);
  if (!profile) profile = await affiliateService.autoEnroll(auth.userId).catch(() => null);
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

  // payeeUserId (not affiliateId alone) — a MANAGER_SPREAD row now carries
  // this SAME affiliateId when it was triggered by this affiliate's traffic
  // (see generateManagerSpreadForAffiliate), but pays the MANAGER, not this
  // affiliate. Without this filter, the affiliate's own dashboard would
  // show money credited to someone else as if they'd earned it themselves.
  const [total, today, last7d, last30d, available, locked, referredCount, confirmedDeposits, referredDeposits] =
    await Promise.all([
      commissionRepository.sumAmountCents({ affiliateId: profile.id, payeeUserId: auth.userId }),
      commissionRepository.sumAmountCents({ affiliateId: profile.id, payeeUserId: auth.userId, from: startOfToday }),
      commissionRepository.sumAmountCents({ affiliateId: profile.id, payeeUserId: auth.userId, from: sevenDaysAgo }),
      commissionRepository.sumAmountCents({ affiliateId: profile.id, payeeUserId: auth.userId, from: thirtyDaysAgo }),
      commissionRepository.sumAmountCents({ affiliateId: profile.id, payeeUserId: auth.userId, status: "AVAILABLE" }),
      commissionRepository.sumAmountCents({ affiliateId: profile.id, payeeUserId: auth.userId, status: "LOCKED" }),
      prisma.user.count({ where: { referredById: auth.userId } }),
      commissionRepository.countConfirmedDeposits(profile.id),
      // Direct read, same precedent as the manager-code resolution above —
      // gross deposit volume by this affiliate's referred players ("Total
      // Depositado"), not something commission.service.ts tracks (it only
      // knows the commission cut, not the underlying deposit total).
      prisma.deposit.aggregate({
        where: { user: { referredById: auth.userId }, status: "PAID" },
        _sum: { amountCents: true },
      }),
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
    referredDepositTotalCents: referredDeposits._sum.amountCents ?? 0,
  });
}

/** Self-service first-touch manager attribution — see AffiliateService.assignManagerIfUnset's doc comment. */
export async function handleAssignAffiliateManager(req: NextRequest, auth: AuthContext) {
  const body = assignAffiliateManagerSchema.parse(await req.json());
  const profile = await affiliateService.assignManagerIfUnset(auth.userId, body.managerCode);
  return ok(toAffiliateProfileDto(profile));
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
  // payeeUserId — same reasoning as handleGetAffiliateDashboard above: this
  // affiliate's own commission history must never include a MANAGER_SPREAD
  // row that shares their affiliateId but was actually paid to their manager.
  const { items, total } = await commissionRepository.listAdmin({
    affiliateId: profile.id,
    payeeUserId: auth.userId,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });
  return ok(items.map(toCommissionHistoryDto), buildPaginationMeta(pagination, total));
}
