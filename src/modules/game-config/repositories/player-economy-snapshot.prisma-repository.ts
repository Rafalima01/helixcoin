import { prisma } from "@/lib/prisma";
import type {
  IPlayerEconomySnapshotRepository,
  PlayerEconomySnapshot,
} from "@/modules/game-config/interfaces/player-economy-snapshot-repository.interface";

export class PrismaPlayerEconomySnapshotRepository implements IPlayerEconomySnapshotRepository {
  async getSnapshot(userId: string): Promise<PlayerEconomySnapshot> {
    const [user, wallet, withdrawSum] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { tags: true } }),
      prisma.wallet.findUnique({ where: { userId } }),
      prisma.walletTransaction.aggregate({
        where: { userId, type: "WITHDRAW", status: "COMPLETED" },
        _sum: { amount: true },
      }),
    ]);

    return {
      tags: user?.tags ?? [],
      balance: wallet?.balance ?? 0,
      totalWithdrawn: withdrawSum._sum.amount ?? 0,
    };
  }
}
