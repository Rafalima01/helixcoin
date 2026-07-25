import type { GameMode, MatchStatus, MatchEventType } from "@prisma/client";

export type { MatchStatus, MatchEventType };

/** Domain entity — see this module's README for the state machine and snapshot semantics. */
export interface Match {
  id: string;
  matchNumber: string;
  userId: string;

  betAmount: number;
  status: MatchStatus;
  platformsPassed: number;
  multiplier: number;
  targetMultiplier: number;
  goalAmount: number;
  potentialPayout: number | null;
  payout: number | null;

  balanceBefore: number;
  balanceAfter: number | null;

  seed: string;
  tokenHash: string;

  mode: GameMode;
  configVersion: number | null;
  presetKey: string | null;
  engineParams: Record<string, number | boolean> | null;
  goalSnapshot: Record<string, unknown> | null;
  antiCheatSnapshot: Record<string, number> | null;

  startedAt: Date | null;
  resolvedAt: Date | null;
  durationSeconds: number | null;

  longestStreak: number;
  collisionCount: number;
  avgSpeed: number | null;

  riskScore: number;
  invalidationReason: string | null;

  engineVersion: string | null;
  ip: string | null;
  userAgent: string | null;
  device: string | null;
  os: string | null;
  location: string | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  type: MatchEventType;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

export interface MatchSummary {
  id: string;
  matchNumber: string;
  userId: string;
  status: MatchStatus;
  mode: GameMode;
  betAmount: number;
  multiplier: number;
  targetMultiplier: number;
  payout: number | null;
  platformsPassed: number;
  riskScore: number;
  createdAt: Date;
  resolvedAt: Date | null;
}
