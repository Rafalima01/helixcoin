import type { Metadata } from "next";
import { FREE_ROUND_CONFIG, FREE_ROUND_FIRST_DEPOSIT_BONUS_PERCENT } from "@/config/free-round-config";
import { DemoPlayScreen } from "@/components/demo/demo-play-screen";

export const metadata: Metadata = { title: "Jogada Grátis — HeliJump" };

/**
 * Deliberately outside PLAYER_AUTH_PREFIXES (src/proxy.ts) and with no
 * getServerAuthContext() guard, unlike src/app/play/page.tsx — anyone can
 * play the free round without an account.
 *
 * Deliberately static — no Prisma, no Postgres, no gameConfigContainer/
 * promotionsContainer call. This page must render even when the database is
 * unreachable, so its difficulty comes from the frozen snapshot in
 * src/config/free-round-config.ts (a copy of config.modes.DEMO's registry
 * defaults) instead of a live read. No Match/Wallet/RTP-financial path is
 * touched — this route never calls /api/matches/*.
 */
export default function FreeRoundPage() {
  return (
    <div className="relative w-full h-dvh overflow-hidden bg-app-radial">
      <DemoPlayScreen firstDepositBonusPercent={FREE_ROUND_FIRST_DEPOSIT_BONUS_PERCENT} engineParams={FREE_ROUND_CONFIG} />
    </div>
  );
}
