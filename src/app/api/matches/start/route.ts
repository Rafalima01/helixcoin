import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAuthContext } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { roundToCents, centsToReais } from "@/lib/multiplier";
import { gameConfigContainer } from "@/modules/game-config/container";

const startSchema = z.object({ amount: z.number().positive() });

/**
 * Every gameplay-affecting value in the response (`engineParams`) comes
 * straight from the active GameEconomyConfig version for the mode resolved
 * for this user — see src/modules/game-config. Nothing here is hardcoded;
 * the frontend engine only renders what it's handed.
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { gameConfigService } = gameConfigContainer;
  const { mode, config, params } = await gameConfigService.buildEnginePayloadForUser(auth.userId);

  const betAmountCents = roundToCents(parsed.data.amount);
  const { betMin, betMax } = config.general;
  if (betAmountCents < betMin || betAmountCents > betMax) {
    return NextResponse.json(
      {
        error: `A aposta deve estar entre ${centsToReais(betMin).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} e ${centsToReais(betMax).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      },
      { status: 400 }
    );
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: auth.userId } });
  if (!wallet || wallet.balance < betAmountCents) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  const seed = `${auth.userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const targetMultiplier = config.general.targetMultiplierDefault;

  const [match] = await prisma.$transaction([
    prisma.match.create({
      data: {
        userId: auth.userId,
        betAmount: betAmountCents,
        status: "ACTIVE",
        seed,
        // Snapshot everything the admin-defined config decided for this
        // match — a later config change can never move the goalposts (or
        // the physics) of a game already in progress.
        targetMultiplier,
        mode,
        configVersion: config.version,
        engineParams: params as unknown as Prisma.InputJsonValue,
        antiCheatSnapshot: config.antiCheat as unknown as Prisma.InputJsonValue,
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
    targetMultiplier,
    goalAmount: Math.round(betAmountCents * targetMultiplier),
    mode,
    configVersion: config.version,
    engineParams: params,
  });
}
