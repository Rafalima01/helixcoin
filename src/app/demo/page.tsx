import type { Metadata } from "next";
import { promotionsContainer } from "@/modules/promotions/container";
import { DemoPlayScreen } from "@/components/demo/demo-play-screen";

export const metadata: Metadata = { title: "Teste Grátis — HeliJump" };
// Always fetch PromotionSettings fresh — an admin change at /admin/promotions
// must show up on the very next /demo request, never a stale build-time value.
export const dynamic = "force-dynamic";

/**
 * Deliberately outside PLAYER_AUTH_PREFIXES (src/proxy.ts) and with no
 * getServerAuthContext() guard, unlike src/app/play/page.tsx — anyone can
 * play the Demo without an account.
 */
export default async function DemoPage() {
  const settings = await promotionsContainer.promotionsService.getSettings();

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-app-radial">
      <DemoPlayScreen firstDepositBonusPercent={settings.firstDepositBonusPercent} />
    </div>
  );
}
