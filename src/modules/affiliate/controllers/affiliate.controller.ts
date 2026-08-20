import type { NextRequest } from "next/server";
import { ok, created, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { NotFoundError } from "@/server/errors";
// Direct read, same precedent as affiliate.service.ts's apply() — resolving
// a manager's inviteCode has no natural home in this module's own
// repository interfaces, not worth a cross-module dependency for.
import { prisma } from "@/lib/prisma";
import { affiliateContainer } from "@/modules/affiliate/container";
import { getAffiliateRawMetrics } from "@/modules/affiliate/services/affiliate-metrics";
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
 * `data` is `null` whenever the player has no AffiliateProfile — the normal
 * case for every account now, since signup no longer auto-enrolls anyone
 * (see auth.controller.ts's handleRegister) and this handler no longer
 * self-heals one into existence just because the "Indique" tab was opened.
 * An account only ever gets an AffiliateProfile via an explicit admin action
 * (AffiliateService.adminCreateDirect, "Transformar em afiliado") or the
 * self-service apply() flow. AffiliatePanel (src/components/referrals)
 * branches its UI on this being null.
 */
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

/**
 * The "Indique e Ganhe" self-service dashboard — works for EVERY logged-in
 * player, not just accounts an admin promoted to AffiliateProfile. Referral
 * identity (User.referralCode/referredById, set at signup — see
 * auth.service.ts's register()) has always been independent of
 * AffiliateProfile, so `profile` missing here must never turn into a 404:
 * it only means this account was never administratively promoted, which
 * getAffiliateRawMetrics(null, ...) already accounts for (real
 * referredCount/referredDepositTotalCents, structurally zero commission
 * figures, default 5% commissionPercent). See AffiliateDashboardDto's doc
 * comment for the full split.
 */
export async function handleGetAffiliateDashboard(_req: NextRequest, auth: AuthContext) {
  const [profile, settings] = await Promise.all([
    affiliateService.getProfile(auth.userId).catch(() => null),
    affiliateService.getSettings(),
  ]);
  const m = await getAffiliateRawMetrics(commissionRepository, profile?.id ?? null, auth.userId);

  return ok({
    commissionTotalCents: m.commissionTotalCents,
    commissionTodayCents: m.commissionTodayCents,
    commission7dCents: m.commission7dCents,
    commission30dCents: m.commission30dCents,
    balanceAvailableCents: m.balanceAvailableCents,
    balanceLockedCents: m.balanceLockedCents,
    referredCount: m.referredCount,
    confirmedDeposits: m.confirmedDeposits,
    // Unchanged from before this handler was refactored to share
    // getAffiliateRawMetrics — still confirmedDeposits/referredCount, NOT
    // ftdCount, so this player's own "Indique" tab shows the exact same
    // number it always has. The admin performance view (see
    // affiliate-admin.controller.ts) uses ftdCount instead — see
    // getAffiliateRawMetrics's doc comment for why the two differ on purpose.
    conversionPercent: m.referredCount > 0 ? Math.round((m.confirmedDeposits / m.referredCount) * 1000) / 10 : 0,
    linkClicks: profile?.linkClicks ?? 0,
    referredDepositTotalCents: m.referredDepositTotalCents,
    resolvedCommissionPercent: resolveCommissionPercent(profile?.revShareOverridePercent ?? null, settings.revShareLevel1Percent),
    managerId: profile?.managerId ?? null,
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
