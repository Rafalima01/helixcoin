import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { betSchema } from "@/lib/validation";
import { roundToCents } from "@/lib/multiplier";
import { getGameConfig } from "@/lib/game-config";

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = betSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const betAmountCents = roundToCents(parsed.data.amount);

  const wallet = await prisma.wallet.findUnique({ where: { userId: auth.userId } });
  if (!wallet || wallet.balance < betAmountCents) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  const config = await getGameConfig();
  const seed = `${auth.userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const [match] = await prisma.$transaction([
    prisma.match.create({
      data: {
        userId: auth.userId,
        betAmount: betAmountCents,
        status: "ACTIVE",
        seed,
        // Snapshot the admin-defined goal so a config change mid-match can
        // never move the goalposts of a running game.
        targetMultiplier: config.targetMultiplier,
      },
    }),
    prisma.wallet.update({
      where: { userId: auth.userId },
      data: { balance: { decrement: betAmountCents } },
    }),
    prisma.transaction.create({
      data: {
        userId: auth.userId,
        type: "BET",
        amount: betAmountCents,
        status: "COMPLETED",
      },
    }),
  ]);

  return NextResponse.json({
    matchId: match.id,
    seed: match.seed,
    betAmount: betAmountCents,
    targetMultiplier: config.targetMultiplier,
    goalAmount: Math.round(betAmountCents * config.targetMultiplier),
  });
}
