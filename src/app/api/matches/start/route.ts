import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { betSchema } from "@/lib/validation";
import { roundToCents } from "@/lib/multiplier";
import { getGameConfig } from "@/lib/game-config";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = betSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const betAmountCents = roundToCents(parsed.data.amount);

  const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
  if (!wallet || wallet.balance < betAmountCents) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  const config = await getGameConfig();
  const seed = `${session.user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const [match] = await prisma.$transaction([
    prisma.match.create({
      data: {
        userId: session.user.id,
        betAmount: betAmountCents,
        status: "ACTIVE",
        seed,
        // Snapshot the admin-defined goal so a config change mid-match can
        // never move the goalposts of a running game.
        targetMultiplier: config.targetMultiplier,
      },
    }),
    prisma.wallet.update({
      where: { userId: session.user.id },
      data: { balance: { decrement: betAmountCents } },
    }),
    prisma.transaction.create({
      data: {
        userId: session.user.id,
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
