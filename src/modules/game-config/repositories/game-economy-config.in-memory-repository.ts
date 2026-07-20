import type {
  IGameEconomyConfigRepository,
  CreateDraftInput,
  UpdateDraftInput,
} from "@/modules/game-config/interfaces/game-economy-config-repository.interface";
import type {
  GameEconomyConfig,
  GameEconomyConfigSummary,
} from "@/modules/game-config/entities/game-economy-config.entity";
import { NotFoundError } from "@/server/errors";

/** In-memory implementation — what tests inject instead of a real database (see tests/game-config.service.test.ts). */
export class InMemoryGameEconomyConfigRepository implements IGameEconomyConfigRepository {
  private readonly rows = new Map<string, GameEconomyConfig>();

  async findActive(): Promise<GameEconomyConfig | null> {
    return [...this.rows.values()].find((r) => r.status === "ACTIVE") ?? null;
  }

  async findDraft(): Promise<GameEconomyConfig | null> {
    return [...this.rows.values()].find((r) => r.status === "DRAFT") ?? null;
  }

  async findById(id: string): Promise<GameEconomyConfig | null> {
    return this.rows.get(id) ?? null;
  }

  async findLatestVersionNumber(): Promise<number> {
    return [...this.rows.values()].reduce((max, r) => Math.max(max, r.version), 0);
  }

  async createDraft(input: CreateDraftInput): Promise<GameEconomyConfig> {
    const row: GameEconomyConfig = {
      id: crypto.randomUUID(),
      version: input.version,
      status: "DRAFT",
      description: input.description ?? null,
      general: input.general,
      modes: input.modes,
      antiCheat: input.antiCheat,
      createdById: input.createdById,
      createdAt: new Date(),
      activatedAt: null,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async updateDraft(id: string, patch: UpdateDraftInput): Promise<GameEconomyConfig> {
    const row = this.rows.get(id);
    if (!row) throw new NotFoundError("GameEconomyConfig");
    const updated: GameEconomyConfig = {
      ...row,
      description: patch.description !== undefined ? patch.description : row.description,
      general: patch.general ?? row.general,
      modes: patch.modes ?? row.modes,
      antiCheat: patch.antiCheat ?? row.antiCheat,
    };
    this.rows.set(id, updated);
    return updated;
  }

  async archiveActive(): Promise<void> {
    const active = await this.findActive();
    if (!active) return;
    this.rows.set(active.id, { ...active, status: "ARCHIVED" });
  }

  async markActive(id: string): Promise<GameEconomyConfig> {
    const row = this.rows.get(id);
    if (!row) throw new NotFoundError("GameEconomyConfig");
    const updated: GameEconomyConfig = { ...row, status: "ACTIVE", activatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }

  async listVersions(
    page: number,
    pageSize: number
  ): Promise<{ items: GameEconomyConfigSummary[]; total: number }> {
    const all = [...this.rows.values()].sort((a, b) => b.version - a.version);
    const items = all
      .slice((page - 1) * pageSize, page * pageSize)
      .map(({ id, version, status, description, modes, createdById, createdAt, activatedAt }) => ({
        id,
        version,
        status,
        description,
        modes,
        createdById,
        createdAt,
        activatedAt,
      }));
    return { items, total: all.length };
  }
}
