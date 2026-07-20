import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthContext } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { getGameConfig } from "@/lib/game-config";

/**
 * Multi-level referral network, computed ENTIRELY server-side.
 *
 * Every user has exactly ONE referral code and ONE link (/r/CODE). The three
 * levels are the DEPTH of the referral tree relative to the requesting user:
 * people they invited (level 1), people those invited (level 2), and one more
 * hop (level 3). The chain ends there — deeper signups earn nothing.
 * Commission rates per level live in GameConfig (admin panel), never in the
 * frontend.
 */

interface NetworkNode {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  createdAt: Date;
  active: boolean;
  deposited: boolean;
  depositCount: number;
  commissionCents: number;
  children: NetworkNode[];
}

export async function GET(req: NextRequest) {
  const auth = await getAuthContext(req);
  if (!auth) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const [me, config] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { referralCode: true },
    }),
    getGameConfig(),
  ]);
  if (!me) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  const rates = [config.commissionLevel1, config.commissionLevel2, config.commissionLevel3];

  // Breadth-first walk, one query per level, capped at depth 3.
  const select = { id: true, firstName: true, lastName: true, createdAt: true, referredById: true };
  const levelUsers: {
    id: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    referredById: string | null;
  }[][] = [];
  let parentIds = [auth.userId];
  for (let depth = 0; depth < 3; depth++) {
    if (parentIds.length === 0) {
      levelUsers.push([]);
      continue;
    }
    const users = await prisma.user.findMany({
      where: { referredById: { in: parentIds } },
      select,
      orderBy: { createdAt: "asc" },
    });
    levelUsers.push(users);
    parentIds = users.map((u) => u.id);
  }

  // Deposit aggregates for the whole network in a single query.
  const allIds = levelUsers.flat().map((u) => u.id);
  const deposits =
    allIds.length > 0
      ? await prisma.transaction.groupBy({
          by: ["userId"],
          where: { userId: { in: allIds }, type: "DEPOSIT", status: "COMPLETED" },
          _count: { _all: true },
          _sum: { amount: true },
        })
      : [];
  const depositByUser = new Map(
    deposits.map((d) => [d.userId, { count: d._count._all, total: d._sum.amount ?? 0 }])
  );

  // Build nodes + per-level stats.
  const nodesById = new Map<string, NetworkNode>();
  const levels = levelUsers.map((users, i) => {
    const level = (i + 1) as 1 | 2 | 3;
    let depositors = 0;
    let commissionCents = 0;
    for (const u of users) {
      const dep = depositByUser.get(u.id) ?? { count: 0, total: 0 };
      const nodeCommission = Math.round(dep.total * rates[i]);
      if (dep.count > 0) depositors++;
      commissionCents += nodeCommission;
      nodesById.set(u.id, {
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        level,
        createdAt: u.createdAt,
        active: dep.count > 0,
        deposited: dep.count > 0,
        depositCount: dep.count,
        commissionCents: nodeCommission,
        children: [],
      });
    }
    return {
      level,
      ratePct: Math.round(rates[i] * 10000) / 100,
      invited: users.length,
      depositors,
      commissionCents,
    };
  });

  // Wire the tree (children of my direct invites, etc.).
  const tree: NetworkNode[] = [];
  for (const users of levelUsers) {
    for (const u of users) {
      const node = nodesById.get(u.id)!;
      if (u.referredById === auth.userId) {
        tree.push(node);
      } else if (u.referredById && nodesById.has(u.referredById)) {
        nodesById.get(u.referredById)!.children.push(node);
      }
    }
  }

  return NextResponse.json({
    referralCode: me.referralCode,
    linkPath: `/r/${me.referralCode}`,
    levels,
    tree,
    totals: {
      invited: levels[0].invited,
      networkSize: allIds.length,
      depositors: levels.reduce((a, l) => a + l.depositors, 0),
      commissionCents: levels.reduce((a, l) => a + l.commissionCents, 0),
    },
  });
}
