import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { depositSchema } from "@/lib/validation";
import { roundToCents } from "@/lib/multiplier";

function generatePixCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "00020126580014BR.GOV.BCB.PIX";
  for (let i = 0; i < 32; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = depositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const amountCents = roundToCents(parsed.data.amount);

  const transaction = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type: "DEPOSIT",
      amount: amountCents,
      status: "PENDING",
      method: "PIX",
    },
  });

  return NextResponse.json({
    transactionId: transaction.id,
    pixCode: generatePixCode(),
    amount: amountCents,
  });
}
