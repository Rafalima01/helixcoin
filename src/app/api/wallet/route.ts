import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { walletContainer } from "@/modules/wallet/container";

/** Read-only — balance itself is still sourced from WalletService (the sole owner of Wallet balances); only mutation is restricted to services, plain reads stay direct Prisma like every other GET in this route family (see /api/stats, /api/transactions). */
export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [balances, recentTransactions, recentMatches, userRow] = await Promise.all([
    walletContainer.walletService.getBalance(auth.userId),
    prisma.walletTransaction.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.match.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        referralCode: true,
        xp: true,
        level: true,
      },
    }),
  ]);

  const user = userRow && {
    name: `${userRow.firstName} ${userRow.lastName}`.trim(),
    email: userRow.email,
    image: userRow.avatar,
    referralCode: userRow.referralCode,
    xp: userRow.xp,
    level: userRow.level,
  };

  return NextResponse.json({
    balance: balances.main,
    bonus: balances.bonus,
    recentTransactions,
    recentMatches,
    user,
  });
}
