import type { Match, MatchEvent, MatchSummary } from "@/modules/match-engine/entities/match.entity";

/** What `POST /api/matches/start` returns — the token is the ONLY time the raw value is ever sent; only its hash is stored. */
export interface MatchCreatedResponseDto {
  matchId: string;
  matchNumber: string;
  token: string;
  seed: string;
  betAmount: number;
  targetMultiplier: number;
  goalAmount: number;
  mode: string;
  configVersion: number | null;
  engineParams: Record<string, number | boolean>;
}

export interface MatchProgressResponseDto {
  matchId: string;
  status: string;
  platformsPassed: number;
  multiplier: number;
  potentialPayout: number;
  goalReached: boolean;
  cashoutAvailable: boolean;
}

export interface MatchResolveResponseDto {
  matchId: string;
  status: string;
  multiplier: number;
  payout: number;
  balanceAfter: number | null;
}

export interface MatchSummaryDto {
  id: string;
  matchNumber: string;
  status: string;
  mode: string;
  betAmount: number;
  multiplier: number;
  targetMultiplier: number;
  payout: number | null;
  platformsPassed: number;
  riskScore: number;
  createdAt: string;
  resolvedAt: string | null;
}

export function toMatchSummaryDto(entity: MatchSummary): MatchSummaryDto {
  return {
    id: entity.id,
    matchNumber: entity.matchNumber,
    status: entity.status,
    mode: entity.mode,
    betAmount: entity.betAmount,
    multiplier: entity.multiplier,
    targetMultiplier: entity.targetMultiplier,
    payout: entity.payout,
    platformsPassed: entity.platformsPassed,
    riskScore: entity.riskScore,
    createdAt: entity.createdAt.toISOString(),
    resolvedAt: entity.resolvedAt?.toISOString() ?? null,
  };
}

/** Admin-only — full detail, never editable (read path exclusively). */
export interface MatchDetailDto extends Omit<Match, "createdAt" | "updatedAt" | "startedAt" | "resolvedAt" | "deletedAt" | "tokenHash"> {
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  events: MatchEventDto[];
}

export interface MatchEventDto {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export function toMatchEventDto(entity: MatchEvent): MatchEventDto {
  return {
    id: entity.id,
    type: entity.type,
    payload: entity.payload,
    createdAt: entity.createdAt.toISOString(),
  };
}

export function toMatchDetailDto(entity: Match, events: MatchEvent[]): MatchDetailDto {
  // tokenHash is deliberately omitted below — never exposed, even to admins.
  return {
    id: entity.id,
    matchNumber: entity.matchNumber,
    userId: entity.userId,
    betAmount: entity.betAmount,
    status: entity.status,
    platformsPassed: entity.platformsPassed,
    multiplier: entity.multiplier,
    targetMultiplier: entity.targetMultiplier,
    goalAmount: entity.goalAmount,
    potentialPayout: entity.potentialPayout,
    payout: entity.payout,
    balanceBefore: entity.balanceBefore,
    balanceAfter: entity.balanceAfter,
    seed: entity.seed,
    mode: entity.mode,
    configVersion: entity.configVersion,
    presetKey: entity.presetKey,
    engineParams: entity.engineParams,
    goalSnapshot: entity.goalSnapshot,
    antiCheatSnapshot: entity.antiCheatSnapshot,
    durationSeconds: entity.durationSeconds,
    longestStreak: entity.longestStreak,
    collisionCount: entity.collisionCount,
    avgSpeed: entity.avgSpeed,
    riskScore: entity.riskScore,
    invalidationReason: entity.invalidationReason,
    engineVersion: entity.engineVersion,
    ip: entity.ip,
    userAgent: entity.userAgent,
    device: entity.device,
    os: entity.os,
    location: entity.location,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    startedAt: entity.startedAt?.toISOString() ?? null,
    resolvedAt: entity.resolvedAt?.toISOString() ?? null,
    events: events.map(toMatchEventDto),
  };
}
