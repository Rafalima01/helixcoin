import type { MatchStatus } from "@prisma/client";
import type {
  IMatchRepository,
  CreateMatchInput,
  UpdateMatchInput,
  AdminMatchListFilter,
} from "@/modules/match-engine/interfaces/match-repository.interface";
import type { Match, MatchSummary } from "@/modules/match-engine/entities/match.entity";
import { NotFoundError } from "@/server/errors";

/** In-memory implementation — what tests inject instead of a real database. */
export class InMemoryMatchRepository implements IMatchRepository {
  private readonly rows = new Map<string, Match>();

  async findById(id: string): Promise<Match | null> {
    return this.rows.get(id) ?? null;
  }

  async create(input: CreateMatchInput): Promise<Match> {
    const now = new Date();
    const match: Match = {
      id: input.id ?? crypto.randomUUID(),
      matchNumber: input.matchNumber,
      userId: input.userId,
      betAmount: input.betAmount,
      status: "CREATED",
      platformsPassed: 0,
      multiplier: 1,
      targetMultiplier: input.targetMultiplier,
      goalAmount: input.goalAmount,
      potentialPayout: null,
      payout: null,
      balanceBefore: input.balanceBefore,
      balanceAfter: null,
      seed: input.seed,
      tokenHash: input.tokenHash,
      mode: input.mode,
      configVersion: input.configVersion,
      presetKey: input.presetKey,
      engineParams: input.engineParams,
      goalSnapshot: input.goalSnapshot,
      antiCheatSnapshot: input.antiCheatSnapshot,
      startedAt: null,
      resolvedAt: null,
      durationSeconds: null,
      longestStreak: 0,
      collisionCount: 0,
      avgSpeed: null,
      riskScore: 0,
      invalidationReason: null,
      engineVersion: input.engineVersion,
      ip: input.ip,
      userAgent: input.userAgent,
      device: input.device,
      os: input.os,
      location: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.rows.set(match.id, match);
    return match;
  }

  async update(id: string, patch: UpdateMatchInput): Promise<Match> {
    const existing = this.rows.get(id);
    if (!existing) throw new NotFoundError("Match");
    const updated: Match = { ...existing, ...patch, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async updateIfStatusIn(id: string, fromStatuses: MatchStatus[], patch: UpdateMatchInput): Promise<Match | null> {
    const existing = this.rows.get(id);
    if (!existing || !fromStatuses.includes(existing.status)) return null;
    const updated: Match = { ...existing, ...patch, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async listForUser(userId: string, limit: number): Promise<MatchSummary[]> {
    const terminal = new Set(["CASHED_OUT", "LOST", "CANCELLED", "INVALIDATED"]);
    return [...this.rows.values()]
      .filter((m) => m.userId === userId && terminal.has(m.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map(toSummary);
  }

  async listAdmin(filter: AdminMatchListFilter): Promise<{ items: MatchSummary[]; total: number }> {
    const all = [...this.rows.values()]
      .filter((m) => !filter.status || m.status === filter.status)
      .filter((m) => !filter.mode || m.mode === filter.mode)
      .filter((m) => !filter.userId || m.userId === filter.userId)
      .filter((m) => !filter.from || m.createdAt >= filter.from)
      .filter((m) => !filter.to || m.createdAt <= filter.to)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const items = all.slice((filter.page - 1) * filter.pageSize, filter.page * filter.pageSize).map(toSummary);
    return { items, total: all.length };
  }
}

function toSummary(m: Match): MatchSummary {
  return {
    id: m.id,
    matchNumber: m.matchNumber,
    userId: m.userId,
    status: m.status,
    mode: m.mode,
    betAmount: m.betAmount,
    multiplier: m.multiplier,
    targetMultiplier: m.targetMultiplier,
    payout: m.payout,
    platformsPassed: m.platformsPassed,
    riskScore: m.riskScore,
    createdAt: m.createdAt,
    resolvedAt: m.resolvedAt,
  };
}
