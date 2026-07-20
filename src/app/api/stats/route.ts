import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { prisma } from "@/lib/prisma";

/** Account-level aggregates for the profile screen. All values in cents. */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [sums, wallet] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: { userId: auth.userId, status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.wallet.findUnique({ where: { userId: auth.userId } }),
  ]);

  const byType = Object.fromEntries(sums.map((s) => [s.type, s._sum.amount ?? 0]));
  const totalDeposited = byType.DEPOSIT ?? 0;
  const totalWithdrawn = byType.WITHDRAW ?? 0;
  const totalBet = byType.BET ?? 0;
  const totalPayout = byType.PAYOUT ?? 0;

  return NextResponse.json({
    totalDeposited,
    totalWithdrawn,
    totalBet,
    totalPayout,
    cashback: 0, // reserved — no cashback engine yet
    balance: wallet?.balance ?? 0,
    netProfit: totalPayout - totalBet,
  });
}
