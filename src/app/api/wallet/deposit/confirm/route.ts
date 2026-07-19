import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Simulates PIX payment confirmation for demo purposes.
 * In production this would be a webhook from the payment provider.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const transactionId = body?.transactionId as string | undefined;
  if (!transactionId) {
    return NextResponse.json({ error: "Transação inválida" }, { status: 400 });
  }

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!transaction || transaction.userId !== session.user.id || transaction.type !== "DEPOSIT") {
    return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
  }
  if (transaction.status === "COMPLETED") {
    const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });
    return NextResponse.json({ balance: wallet?.balance ?? 0 });
  }

  const [, wallet] = await prisma.$transaction([
    prisma.transaction.update({ where: { id: transactionId }, data: { status: "COMPLETED" } }),
    prisma.wallet.update({
      where: { userId: session.user.id },
      data: { balance: { increment: transaction.amount } },
    }),
  ]);

  return NextResponse.json({ balance: wallet.balance });
}
