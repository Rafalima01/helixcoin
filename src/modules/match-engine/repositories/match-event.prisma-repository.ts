import type { MatchEvent as PrismaMatchEvent, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IMatchEventRepository,
  CreateMatchEventInput,
} from "@/modules/match-engine/interfaces/match-event-repository.interface";
import type { MatchEvent } from "@/modules/match-engine/entities/match.entity";

function toEntity(row: PrismaMatchEvent): MatchEvent {
  return {
    id: row.id,
    matchId: row.matchId,
    type: row.type,
    payload: row.payload as unknown as MatchEvent["payload"],
    createdAt: row.createdAt,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaMatchEventRepository implements IMatchEventRepository {
  async create(input: CreateMatchEventInput): Promise<MatchEvent> {
    const row = await prisma.matchEvent.create({
      data: {
        matchId: input.matchId,
        type: input.type,
        payload: toJson(input.payload),
      },
    });
    return toEntity(row);
  }

  async listForMatch(matchId: string): Promise<MatchEvent[]> {
    const rows = await prisma.matchEvent.findMany({
      where: { matchId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toEntity);
  }
}
