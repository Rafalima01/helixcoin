import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGameConfig } from "@/lib/game-config";

/**
 * Read-only game configuration. The target multiplier ("meta") is controlled
 * exclusively by the backend/admin — the frontend can never change it.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const config = await getGameConfig();
  return NextResponse.json({ targetMultiplier: config.targetMultiplier });
}
