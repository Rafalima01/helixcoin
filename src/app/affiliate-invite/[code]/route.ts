import { NextResponse, type NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { managerContainer } from "@/modules/manager/container";
import { zoneUrl } from "@/config/domains";

/**
 * A Manager's "Convidar Afiliados" link (see AGENTS.md's "Refinamento Fase
 * 8", the two-link model) — NOT for players, only recruits affiliates.
 * Mirrors /r/[code]/route.ts's pattern but resolves ManagerProfile.inviteCode
 * instead of User.referralCode, and branches on auth state the same way
 * /r/[code] doesn't need to (a player link always goes to /signup, but an
 * affiliate-invite click can come from someone already logged in as a
 * player wanting to become an affiliate too):
 *  - Unauthenticated → straight to /signup?managerCode=CODE, so the manager
 *    link gets attributed atomically at signup (AuthService.register(),
 *    mirrors `referralCode`) instead of depending on a client-side
 *    `assignManagerIfUnset()` effect that only fires if the person later
 *    visits the "Indique" tab while logged in.
 *  - Authenticated → unchanged: redirect into the "Indique" tab
 *    (/referrals) with the manager code pre-filled; that tab's own
 *    `assignManagerIfUnset()` effect still covers this case (an existing
 *    player becoming an affiliate under this manager).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const manager = await managerContainer.managerRepository.findByInviteCode(code);
  if (manager) await managerContainer.managerRepository.incrementInviteLinkClicks(code);

  const auth = await getAuthContext(req);
  const applyUrl = auth
    ? zoneUrl("player", `/referrals?manager=${encodeURIComponent(code)}`)
    : zoneUrl("player", `/signup?managerCode=${encodeURIComponent(code)}`);
  return NextResponse.redirect(applyUrl);
}
