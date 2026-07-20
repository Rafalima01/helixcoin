import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { withdrawSchema } from "@/lib/validation";
import { roundToCents } from "@/lib/multiplier";

export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = withdrawSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const amountCents = roundToCents(parsed.data.amount);

  const wallet = await prisma.wallet.findUnique({ where: { userId: auth.userId } });
  if (!wallet || wallet.balance < amountCents) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  const [, updatedWallet] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId: auth.userId,
        type: "WITHDRAW",
        amount: amountCents,
        status: "COMPLETED",
        method: "PIX",
        pixKey: parsed.data.pixKey,
      },
    }),
    prisma.wallet.update({
      where: { userId: auth.userId },
      data: { balance: { decrement: amountCents } },
    }),
  ]);

  return NextResponse.json({ balance: updatedWallet.balance });
}
