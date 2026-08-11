import type { GameEconomyConfig as PrismaGameEconomyConfig, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  IGameEconomyConfigRepository,
  CreateDraftInput,
  UpdateDraftInput,
} from "@/modules/game-config/interfaces/game-economy-config-repository.interface";
import type {
  GameEconomyConfig,
  GameEconomyConfigSummary,
} from "@/modules/game-config/entities/game-economy-config.entity";
import { withRegistryDefaults } from "@/modules/game-config/utils/config-defaults.util";
import { NotFoundError } from "@/server/errors";

function toEntity(row: PrismaGameEconomyConfig): GameEconomyConfig {
  // Json columns have no compile-time shape in Prisma — the field-registry
  // (validated at write time, in the service layer) is the real contract.
  // withRegistryDefaults backfills any key a field was added for AFTER this
  // row was saved, so an old row never fails activation just because a
  // newer field is missing from it — see that function's doc comment.
  const { general, modes, antiCheat } = withRegistryDefaults({
    general: row.general as unknown as GameEconomyConfig["general"],
    modes: row.modes as unknown as GameEconomyConfig["modes"],
    antiCheat: row.antiCheat as unknown as GameEconomyConfig["antiCheat"],
  });
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    description: row.description,
    general,
    modes,
    antiCheat,
    createdById: row.createdById,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export class PrismaGameEconomyConfigRepository implements IGameEconomyConfigRepository {
  async findActive(): Promise<GameEconomyConfig | null> {
    const row = await prisma.gameEconomyConfig.findFirst({ where: { status: "ACTIVE" } });
    return row ? toEntity(row) : null;
  }

  async findDraft(): Promise<GameEconomyConfig | null> {
    const row = await prisma.gameEconomyConfig.findFirst({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "desc" },
    });
    return row ? toEntity(row) : null;
  }

  async findById(id: string): Promise<GameEconomyConfig | null> {
    const row = await prisma.gameEconomyConfig.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async findLatestVersionNumber(): Promise<number> {
    const row = await prisma.gameEconomyConfig.findFirst({ orderBy: { version: "desc" } });
    return row?.version ?? 0;
  }

  async createDraft(input: CreateDraftInput): Promise<GameEconomyConfig> {
    const row = await prisma.gameEconomyConfig.create({
      data: {
        version: input.version,
        status: "DRAFT",
        description: input.description ?? null,
        general: toJson(input.general),
        modes: toJson(input.modes),
        antiCheat: toJson(input.antiCheat),
        createdById: input.createdById,
      },
    });
    return toEntity(row);
  }

  async updateDraft(id: string, patch: UpdateDraftInput): Promise<GameEconomyConfig> {
    const row = await prisma.gameEconomyConfig.update({
      where: { id },
      data: {
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.general ? { general: toJson(patch.general) } : {}),
        ...(patch.modes ? { modes: toJson(patch.modes) } : {}),
        ...(patch.antiCheat ? { antiCheat: toJson(patch.antiCheat) } : {}),
      },
    });
    return toEntity(row);
  }

  async archiveActive(): Promise<void> {
    await prisma.gameEconomyConfig.updateMany({
      where: { status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });
  }

  async markActive(id: string): Promise<GameEconomyConfig> {
    const existing = await prisma.gameEconomyConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("GameEconomyConfig");
    const row = await prisma.gameEconomyConfig.update({
      where: { id },
      data: { status: "ACTIVE", activatedAt: new Date() },
    });
    return toEntity(row);
  }

  async listVersions(
    page: number,
    pageSize: number
  ): Promise<{ items: GameEconomyConfigSummary[]; total: number }> {
    const [rows, total] = await Promise.all([
      prisma.gameEconomyConfig.findMany({
        orderBy: { version: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          version: true,
          status: true,
          description: true,
          modes: true,
          createdById: true,
          createdAt: true,
          activatedAt: true,
        },
      }),
      prisma.gameEconomyConfig.count(),
    ]);
    return {
      items: rows.map((row) => ({ ...row, modes: row.modes as unknown as GameEconomyConfigSummary["modes"] })),
      total,
    };
  }
}
