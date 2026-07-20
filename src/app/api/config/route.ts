import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { getGameConfig } from "@/lib/game-config";

/**
 * Read-only game configuration. The target multiplier ("meta") is controlled
 * exclusively by the backend/admin — the frontend can never change it.
 */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const config = await getGameConfig();
  return NextResponse.json({ targetMultiplier: config.targetMultiplier });
}
