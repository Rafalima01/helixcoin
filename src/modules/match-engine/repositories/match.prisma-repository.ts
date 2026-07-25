import type { Match as PrismaMatch, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IMatchRepository,
  CreateMatchInput,
  UpdateMatchInput,
  AdminMatchListFilter,
} from "@/modules/match-engine/interfaces/match-repository.interface";
import type { Match, MatchSummary } from "@/modules/match-engine/entities/match.entity";
import { NotFoundError } from "@/server/errors";

function toEntity(row: PrismaMatch): Match {
  return {
    id: row.id,
    matchNumber: row.matchNumber,
    userId: row.userId,
    betAmount: row.betAmount,
    status: row.status,
    platformsPassed: row.platformsPassed,
    multiplier: row.multiplier,
    targetMultiplier: row.targetMultiplier,
    goalAmount: row.goalAmount,
    potentialPayout: row.potentialPayout,
    payout: row.payout,
    balanceBefore: row.balanceBefore,
    balanceAfter: row.balanceAfter,
    seed: row.seed,
    tokenHash: row.tokenHash,
    mode: row.mode,
    configVersion: row.configVersion,
    presetKey: row.presetKey,
    // Json columns have no compile-time shape in Prisma — validated at
    // write time by the service layer (mirrors game-config's own precedent).
    engineParams: row.engineParams as unknown as Match["engineParams"],
    goalSnapshot: row.goalSnapshot as unknown as Match["goalSnapshot"],
    antiCheatSnapshot: row.antiCheatSnapshot as unknown as Match["antiCheatSnapshot"],
    startedAt: row.startedAt,
    resolvedAt: row.resolvedAt,
    durationSeconds: row.durationSeconds,
    longestStreak: row.longestStreak,
    collisionCount: row.collisionCount,
    avgSpeed: row.avgSpeed,
    riskScore: row.riskScore,
    invalidationReason: row.invalidationReason,
    engineVersion: row.engineVersion,
    ip: row.ip,
    userAgent: row.userAgent,
    device: row.device,
    os: row.os,
    location: row.location,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function toSummary(row: PrismaMatch): MatchSummary {
  return {
    id: row.id,
    matchNumber: row.matchNumber,
    userId: row.userId,
    status: row.status,
    mode: row.mode,
    betAmount: row.betAmount,
    multiplier: row.multiplier,
    targetMultiplier: row.targetMultiplier,
    payout: row.payout,
    platformsPassed: row.platformsPassed,
    riskScore: row.riskScore,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaMatchRepository implements IMatchRepository {
  async findById(id: string): Promise<Match | null> {
    const row = await prisma.match.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async create(input: CreateMatchInput): Promise<Match> {
    const row = await prisma.match.create({
      data: {
        id: input.id,
        matchNumber: input.matchNumber,
        userId: input.userId,
        betAmount: input.betAmount,
        goalAmount: input.goalAmount,
        balanceBefore: input.balanceBefore,
        seed: input.seed,
        tokenHash: input.tokenHash,
        targetMultiplier: input.targetMultiplier,
        mode: input.mode,
        configVersion: input.configVersion,
        presetKey: input.presetKey,
        engineParams: toJson(input.engineParams),
        goalSnapshot: toJson(input.goalSnapshot),
        antiCheatSnapshot: toJson(input.antiCheatSnapshot),
        engineVersion: input.engineVersion,
        ip: input.ip,
        userAgent: input.userAgent,
        device: input.device,
        os: input.os,
        status: "CREATED",
      },
    });
    return toEntity(row);
  }

  async update(id: string, patch: UpdateMatchInput): Promise<Match> {
    const existing = await prisma.match.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Match");
    const row = await prisma.match.update({ where: { id }, data: patch });
    return toEntity(row);
  }

  async listForUser(userId: string, limit: number): Promise<MatchSummary[]> {
    const rows = await prisma.match.findMany({
      where: {
        userId,
        status: { in: ["CASHED_OUT", "LOST", "CANCELLED", "INVALIDATED"] },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toSummary);
  }

  async listAdmin(filter: AdminMatchListFilter): Promise<{ items: MatchSummary[]; total: number }> {
    const where: Prisma.MatchWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.mode ? { mode: filter.mode } : {}),
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.match.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filter.page - 1) * filter.pageSize,
        take: filter.pageSize,
      }),
      prisma.match.count({ where }),
    ]);

    return { items: rows.map(toSummary), total };
  }
}
