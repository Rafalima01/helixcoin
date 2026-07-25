import type { MatchStatus } from "@prisma/client";
import { BusinessRuleError } from "@/server/errors";

/**
 * The one place every allowed Match status transition is defined. See this
 * module's README for the diagram — CREATED → AWAITING_START → IN_PROGRESS →
 * GOAL_REACHED → CASHOUT_AVAILABLE → CASHED_OUT, with LOST/CANCELLED/
 * INVALIDATED reachable from wherever they're realistically possible:
 *   - LOST only once actually playing (IN_PROGRESS onward) — you can't lose
 *     a game you haven't started.
 *   - CANCELLED (forfeit/abandon) from any non-terminal state.
 *   - INVALIDATED (anti-cheat) only once there's telemetry to judge
 *     (IN_PROGRESS onward) — nothing to invalidate before that.
 * Every other pair is rejected. Pure and stateless — no Prisma, no I/O — so
 * it's exhaustively unit tested without a database.
 */
const TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  CREATED: ["AWAITING_START", "CANCELLED"],
  AWAITING_START: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["GOAL_REACHED", "LOST", "CANCELLED", "INVALIDATED"],
  GOAL_REACHED: ["CASHOUT_AVAILABLE", "LOST", "CANCELLED", "INVALIDATED"],
  CASHOUT_AVAILABLE: ["CASHED_OUT", "LOST", "CANCELLED", "INVALIDATED"],
  CASHED_OUT: [],
  LOST: [],
  CANCELLED: [],
  INVALIDATED: [],
};

export function canTransition(from: MatchStatus, to: MatchStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Throws BusinessRuleError (422) if the transition isn't allowed — the service calls this before every status write. */
export function assertTransition(from: MatchStatus, to: MatchStatus): void {
  if (!canTransition(from, to)) {
    throw new BusinessRuleError(`Transição de status inválida: ${from} → ${to}`);
  }
}

export function isTerminalStatus(status: MatchStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Statuses in which the match is actively being played — used to gate /progress and /begin. */
export const ACTIVE_STATUSES: readonly MatchStatus[] = [
  "AWAITING_START",
  "IN_PROGRESS",
  "GOAL_REACHED",
  "CASHOUT_AVAILABLE",
];
