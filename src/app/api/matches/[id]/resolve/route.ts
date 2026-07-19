import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMultiplierForPlatforms } from "@/lib/multiplier";

const resolveSchema = z.object({
  action: z.enum(["cashout", "loss", "forfeit"]),
  platformsPassed: z.number().int().min(0).max(500),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id } });
  if (!match || match.userId !== session.user.id) {
    return NextResponse.json({ error: "Partida não encontrada" }, { status: 404 });
  }
  if (match.status !== "ACTIVE") {
    return NextResponse.json({
      matchId: match.id,
      status: match.status,
      multiplier: match.multiplier,
      payout: match.payout ?? 0,
    });
  }

  const { action, platformsPassed } = parsed.data;

  if (action === "loss" || action === "forfeit") {
    const updated = await prisma.match.update({
      where: { id },
      data: {
        status: "LOST",
        platformsPassed,
        multiplier: getMultiplierForPlatforms(platformsPassed),
        payout: 0,
        resolvedAt: new Date(),
      },
    });
    return NextResponse.json({
      matchId: updated.id,
      status: updated.status,
      multiplier: updated.multiplier,
      payout: 0,
    });
  }

  const multiplier = getMultiplierForPlatforms(platformsPassed);

  // Cashout is locked until the admin-defined goal is reached. The check
  // lives here — the frontend button state is cosmetic, never trusted.
  // (Small epsilon absorbs float noise between client and server curves.)
  if (multiplier < match.targetMultiplier - 1e-9) {
    return NextResponse.json(
      { error: "Meta ainda não atingida — o resgate está bloqueado." },
      { status: 400 }
    );
  }

  const payout = Math.round(match.betAmount * multiplier);

  const [updated] = await prisma.$transaction([
    prisma.match.update({
      where: { id },
      data: {
        status: "CASHED_OUT",
        platformsPassed,
        multiplier,
        payout,
        resolvedAt: new Date(),
      },
    }),
    prisma.wallet.update({
      where: { userId: session.user.id },
      data: { balance: { increment: payout } },
    }),
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "PAYOUT",
        amount: payout,
        status: "COMPLETED",
        matchId: id,
      },
    }),
  ]);

  return NextResponse.json({
    matchId: updated.id,
    status: updated.status,
    multiplier: updated.multiplier,
    payout: updated.payout,
  });
}
