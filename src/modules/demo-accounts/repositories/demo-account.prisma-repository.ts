import { prisma } from "@/lib/prisma";
import type { DemoAccountRow } from "@/modules/demo-accounts/entities/demo-account.entity";
import type { IDemoAccountRepository } from "@/modules/demo-accounts/interfaces/demo-account-repository.interface";

export class PrismaDemoAccountRepository implements IDemoAccountRepository {
  async list(): Promise<DemoAccountRow[]> {
    const users = await prisma.user.findMany({
      where: { isDemo: true, deletedAt: null },
      include: { wallet: true },
      orderBy: { createdAt: "desc" },
    });
    if (users.length === 0) return [];

    // groupBy gives the most recent Session.lastActivityAt per user in one
    // query — Prisma has no per-group "latest row" join, and these lists are
    // small (demo accounts are hand-created by admins), so this is simpler
    // than a raw SQL DISTINCT ON.
    const activity = await prisma.session.groupBy({
      by: ["userId"],
      where: { userId: { in: users.map((u) => u.id) } },
      _max: { lastActivityAt: true },
    });
    const lastActivityByUser = new Map(activity.map((a) => [a.userId, a._max.lastActivityAt ?? null]));

    return users.map((u) => ({
      id: u.id,
      fullName: `${u.firstName} ${u.lastName}`.trim(),
      login: u.username,
      phone: u.phone,
      status: u.status,
      balanceCents: u.wallet?.balance ?? 0,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      lastActivityAt: lastActivityByUser.get(u.id) ?? null,
    }));
  }
}
