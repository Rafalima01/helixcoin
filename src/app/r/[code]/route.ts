import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { affiliateContainer } from "@/modules/affiliate/container";
import { managerContainer } from "@/modules/manager/container";
import { zoneUrl } from "@/config/domains";

/**
 * Short referral link — the ONLY link a user shares: /r/CODE. Redirects to
 * signup with the code pre-filled. `?l={slug}` is an OPTIONAL Phase 8
 * campaign tag (see AffiliateLink's schema doc comment) — never a second
 * attribution mechanism: a bad/paused/missing slug just means the click
 * isn't tagged for campaign analytics, `referredById` is still set exactly
 * as it always has been from `code` alone.
 *
 * "Refinamento Fase 8": this is also a Manager's "Meu Link da Plataforma"
 * (see AGENTS.md decision A) — no new attribution route, just a click-count
 * bump when `code` resolves to a User with a ManagerProfile.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(req.url);
  const slug = url.searchParams.get("l");

  const signupUrl = new URL(zoneUrl("player", `/signup?ref=${encodeURIComponent(code)}`));

  if (slug) {
    const link = await affiliateContainer.affiliateLinkService.findActiveBySlug(slug);
    if (link) {
      await affiliateContainer.affiliateLinkService.registerClick(link.id);
      signupUrl.searchParams.set("l", slug);
    }
  }

  const referrer = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
  if (referrer) {
    const manager = await managerContainer.managerRepository.findByUserId(referrer.id);
    if (manager) await managerContainer.managerRepository.incrementPlatformLinkClicks(referrer.id);

    const affiliate = await affiliateContainer.affiliateRepository.findByUserId(referrer.id);
    if (affiliate && affiliate.status === "APPROVED") {
      await affiliateContainer.affiliateRepository.incrementLinkClicks(referrer.id);
    }
  }

  return NextResponse.redirect(signupUrl);
}
