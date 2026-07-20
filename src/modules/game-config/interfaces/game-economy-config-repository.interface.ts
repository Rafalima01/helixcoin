import type {
  GameEconomyConfig,
  GameEconomyConfigSummary,
  GeneralConfig,
  AntiCheatConfig,
  ModeProfile,
} from "@/modules/game-config/entities/game-economy-config.entity";
import type { GameMode } from "@prisma/client";

export interface CreateDraftInput {
  version: number;
  description?: string | null;
  general: GeneralConfig;
  modes: Record<GameMode, ModeProfile>;
  antiCheat: AntiCheatConfig;
  createdById: string;
}

export interface UpdateDraftInput {
  description?: string | null;
  general?: GeneralConfig;
  modes?: Record<GameMode, ModeProfile>;
  antiCheat?: AntiCheatConfig;
}

/**
 * The service layer (services/game-config.service.ts) depends on THIS
 * interface, never on `@/lib/prisma` directly — see
 * repositories/game-economy-config.prisma-repository.ts for the real
 * implementation and .in-memory-repository.ts for the one tests inject.
 */
export interface IGameEconomyConfigRepository {
  findActive(): Promise<GameEconomyConfig | null>;
  findDraft(): Promise<GameEconomyConfig | null>;
  findById(id: string): Promise<GameEconomyConfig | null>;
  /** Highest `version` across every row ever created (draft/active/archived), 0 if none exist. */
  findLatestVersionNumber(): Promise<number>;
  createDraft(input: CreateDraftInput): Promise<GameEconomyConfig>;
  updateDraft(id: string, patch: UpdateDraftInput): Promise<GameEconomyConfig>;
  /** Flips the current ACTIVE row (if any) to ARCHIVED. No-op if none is active. */
  archiveActive(): Promise<void>;
  /** Flips a DRAFT row to ACTIVE, stamping `activatedAt`. */
  markActive(id: string): Promise<GameEconomyConfig>;
  listVersions(page: number, pageSize: number): Promise<{ items: GameEconomyConfigSummary[]; total: number }>;
}
