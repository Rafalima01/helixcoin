import type { MatchEventType } from "@prisma/client";
import type { MatchEvent } from "@/modules/match-engine/entities/match.entity";

export interface CreateMatchEventInput {
  matchId: string;
  type: MatchEventType;
  payload?: Record<string, unknown> | null;
}

export interface IMatchEventRepository {
  create(input: CreateMatchEventInput): Promise<MatchEvent>;
  listForMatch(matchId: string): Promise<MatchEvent[]>;
}
