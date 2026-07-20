import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { gameConfigContainer } from "@/modules/game-config/container";
import { centsToReais } from "@/lib/multiplier";

/**
 * Read-only game configuration. Every value here is controlled exclusively
 * by the backend/admin (src/modules/game-config) — the frontend can never
 * change it, only render it.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { gameConfigService } = gameConfigContainer;
  const config = await gameConfigService.getActive();

  return NextResponse.json({
    targetMultiplier: config.general.targetMultiplierDefault,
    betMin: centsToReais(config.general.betMin),
    betMax: centsToReais(config.general.betMax),
    quickBetAmounts: config.general.quickBetAmounts.map(centsToReais),
  });
}
