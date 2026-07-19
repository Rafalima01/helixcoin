import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const wallet = await prisma.wallet.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id, balance: 0 },
  });

  const [recentTransactions, recentMatches, user] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.match.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, image: true, referralCode: true, xp: true, level: true },
    }),
  ]);

  return NextResponse.json({
    balance: wallet.balance,
    recentTransactions,
    recentMatches,
    user,
  });
}
