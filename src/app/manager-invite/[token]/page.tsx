import type { Metadata } from "next";
import { managerContainer } from "@/modules/manager/container";
import { toManagerInvitePublicDto } from "@/modules/manager/dto/manager-invite.dto";
import { InviteAcceptScreen } from "@/components/manager/invite-accept-screen";

export const metadata: Metadata = {
  title: "Convite de Gerente — HeliJump",
  robots: { index: false, follow: false },
};

/**
 * Public — no auth, not covered by src/proxy.ts's matcher (only "/manager/:path*"
 * is auth-gated, and this segment lives outside it) or by src/app/manager/
 * layout.tsx. See AGENTS.md's "Convite de Gerente" decision for why this
 * path was chosen over nesting under /manager/invite/.
 */
export default async function ManagerInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let invite;
  let error: string | null = null;
  try {
    invite = toManagerInvitePublicDto(await managerContainer.managerInviteService.getPublicByToken(token));
  } catch (err) {
    error = err instanceof Error ? err.message : "Convite inválido";
  }

  return <InviteAcceptScreen token={token} invite={invite ?? null} error={error} />;
}
