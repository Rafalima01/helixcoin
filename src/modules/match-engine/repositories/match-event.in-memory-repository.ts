import type {
  IMatchEventRepository,
  CreateMatchEventInput,
} from "@/modules/match-engine/interfaces/match-event-repository.interface";
import type { MatchEvent } from "@/modules/match-engine/entities/match.entity";

export class InMemoryMatchEventRepository implements IMatchEventRepository {
  private readonly rows: MatchEvent[] = [];

  async create(input: CreateMatchEventInput): Promise<MatchEvent> {
    const event: MatchEvent = {
      id: crypto.randomUUID(),
      matchId: input.matchId,
      type: input.type,
      payload: input.payload ?? null,
      createdAt: new Date(),
    };
    this.rows.push(event);
    return event;
  }

  async listForMatch(matchId: string): Promise<MatchEvent[]> {
    return this.rows
      .filter((e) => e.matchId === matchId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
