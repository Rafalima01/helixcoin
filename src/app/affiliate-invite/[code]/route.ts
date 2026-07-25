import { NextResponse } from "next/server";
import { managerContainer } from "@/modules/manager/container";

/**
 * A Manager's "Convidar Afiliados" link (see AGENTS.md's "Refinamento Fase
 * 8", the two-link model) — NOT for players, only recruits affiliates.
 * Mirrors /r/[code]/route.ts's pattern exactly but resolves
 * ManagerProfile.inviteCode instead of User.referralCode. Lives at this
 * top-level path (not under /affiliate, which no longer exists as a route
 * tree — see "Painel do Afiliado Integrado ao Frontend") so it keeps working
 * standalone; redirects into the "Indique" tab (/referrals) — the platform's
 * one and only affiliate entry point — with the manager code pre-filled.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const manager = await managerContainer.managerRepository.findByInviteCode(code);
  if (manager) await managerContainer.managerRepository.incrementInviteLinkClicks(code);

  const applyUrl = new URL(`/referrals?manager=${encodeURIComponent(code)}`, req.url);
  return NextResponse.redirect(applyUrl);
}
