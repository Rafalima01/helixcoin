import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withdrawSchema } from "@/lib/validation";
import { roundToCents } from "@/lib/multiplier";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = withdrawSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const amountCents = roundToCents(parsed.data.amount);

  const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
  if (!wallet || wallet.balance < amountCents) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  const [, updatedWallet] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: "WITHDRAW",
        amount: amountCents,
        status: "COMPLETED",
        method: "PIX",
        pixKey: parsed.data.pixKey,
      },
    }),
    prisma.wallet.update({
      where: { userId: session.user.id },
      data: { balance: { decrement: amountCents } },
    }),
  ]);

  return NextResponse.json({ balance: updatedWallet.balance });
}
