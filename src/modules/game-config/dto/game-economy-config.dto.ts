import type {
  GameEconomyConfig,
  GameEconomyConfigSummary,
} from "@/modules/game-config/entities/game-economy-config.entity";

export interface GameEconomyConfigResponseDto {
  id: string;
  version: number;
  status: string;
  description: string | null;
  general: GameEconomyConfig["general"];
  modes: GameEconomyConfig["modes"];
  antiCheat: GameEconomyConfig["antiCheat"];
  createdById: string;
  createdAt: string;
  activatedAt: string | null;
}

export function toGameEconomyConfigResponseDto(
  entity: GameEconomyConfig
): GameEconomyConfigResponseDto {
  return {
    id: entity.id,
    version: entity.version,
    status: entity.status,
    description: entity.description,
    general: entity.general,
    modes: entity.modes,
    antiCheat: entity.antiCheat,
    createdById: entity.createdById,
    createdAt: entity.createdAt.toISOString(),
    activatedAt: entity.activatedAt?.toISOString() ?? null,
  };
}

export interface GameEconomyConfigVersionSummaryDto {
  id: string;
  version: number;
  status: string;
  description: string | null;
  /** So the version history can show "Baseado no preset" per mode without a second fetch. */
  modes: GameEconomyConfig["modes"];
  createdById: string;
  createdAt: string;
  activatedAt: string | null;
}

export function toVersionSummaryDto(
  entity: GameEconomyConfigSummary
): GameEconomyConfigVersionSummaryDto {
  return {
    id: entity.id,
    version: entity.version,
    status: entity.status,
    description: entity.description,
    modes: entity.modes,
    createdById: entity.createdById,
    createdAt: entity.createdAt.toISOString(),
    activatedAt: entity.activatedAt?.toISOString() ?? null,
  };
}

/** What `/api/matches/start` embeds in its response — the frontend engine's only source of truth. */
export interface EnginePayloadDto {
  mode: string;
  configVersion: number;
  params: Record<string, number | boolean>;
}
