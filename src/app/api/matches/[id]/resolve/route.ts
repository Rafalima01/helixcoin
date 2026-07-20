import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthContext } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { getMultiplierForPlatforms } from "@/lib/multiplier";
import { gameConfigContainer } from "@/modules/game-config/container";
import { recordAntiCheatViolation } from "@/modules/game-config/services/anti-cheat-violation-recorder";
import type { AntiCheatConfig } from "@/modules/game-config/entities/game-economy-config.entity";

const resolveSchema = z.object({
  action: z.enum(["cashout", "loss", "forfeit"]),
  platformsPassed: z.number().int().min(0).max(500),
  // Optional client-reported telemetry — the anti-cheat check simply skips
  // whatever the client didn't report; absence is never itself a violation.
  maxVerticalSpeed: z.number().optional(),
  maxHorizontalSpeed: z.number().optional(),
  maxAcceleration: z.number().optional(),
  collisionsPerSecond: z.number().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id } });
  if (!match || match.userId !== auth.userId) {
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

  // Heuristic, server-side-only anti-cheat (see AntiCheatService's doc
  // comment for why this is deliberately NOT trying to detect client-side
  // tampering) — runs before either branch below, so a flagged attempt can
  // never sneak a payout through the cashout path.
  if (match.antiCheatSnapshot) {
    const { antiCheatService } = gameConfigContainer;
    const elapsedSeconds = (Date.now() - match.createdAt.getTime()) / 1000;
    const limits = match.antiCheatSnapshot as unknown as AntiCheatConfig;

    const check = antiCheatService.check({
      action,
      platformsPassed,
      elapsedSeconds,
      reportedMaxVerticalSpeed: parsed.data.maxVerticalSpeed,
      reportedMaxHorizontalSpeed: parsed.data.maxHorizontalSpeed,
      reportedMaxAcceleration: parsed.data.maxAcceleration,
      reportedCollisionsPerSecond: parsed.data.collisionsPerSecond,
      limits,
    });

    if (check.flagged) {
      await prisma.match.update({
        where: { id },
        data: {
          status: "LOST",
          platformsPassed,
          multiplier: getMultiplierForPlatforms(platformsPassed),
          payout: 0,
          resolvedAt: new Date(),
        },
      });
      await recordAntiCheatViolation({
        userId: auth.userId,
        matchId: id,
        result: check,
        limits: limits as unknown as Record<string, number>,
      });
      return NextResponse.json(
        { error: "Partida cancelada — atividade incompatível com o esperado foi detectada." },
        { status: 400 }
      );
    }
  }

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
      where: { userId: auth.userId },
      data: { balance: { increment: payout } },
    }),
    prisma.transaction.create({
      data: {
        userId: auth.userId,
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
