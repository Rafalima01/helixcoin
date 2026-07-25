import type { Match } from "@/modules/match-engine/entities/match.entity";

/**
 * Internal domain events published on the existing in-process `eventBus`
 * (src/server/events) at every match transition. Nothing subscribes to
 * these yet — they're the extension point future modules (Wallet, Ledger,
 * Analytics, Afiliados, Cashback, Missões, Notificações) will consume, none
 * of which are implemented in this phase.
 */
export const MATCH_ENGINE_EVENTS = {
  created: "match.created",
  started: "match.started",
  progressed: "match.progressed",
  goalReached: "match.goal_reached",
  completed: "match.completed",
  lost: "match.lost",
  cancelled: "match.cancelled",
  invalidated: "match.invalidated",
  cashoutRequested: "match.cashout_requested",
  cashoutApproved: "match.cashout_approved",
  cashoutDenied: "match.cashout_denied",
} as const;

export interface MatchEventPayload {
  match: Match;
}

export interface CashoutDeniedPayload {
  match: Match;
  reason: string;
}
