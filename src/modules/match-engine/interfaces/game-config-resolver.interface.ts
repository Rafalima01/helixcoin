import type { GameMode } from "@prisma/client";

export interface ResolvedMatchConfig {
  mode: GameMode;
  configVersion: number;
  general: {
    betMin: number;
    betMax: number;
    targetMultiplierDefault: number;
    goalMultiplierMin: number;
    goalMultiplierMax: number;
  };
  antiCheat: Record<string, number>;
  engineParams: Record<string, number | boolean>;
}

/**
 * Thin seam over `gameConfigContainer.gameConfigService.buildEnginePayloadForUser`
 * (src/modules/game-config, Phase 4) — exists so MatchEngineService depends
 * on an interface instead of a concrete cross-module singleton, the same
 * reason every repository dependency in this codebase is behind one. Makes
 * `create()` unit-testable with a fake config instead of a real active
 * GameEconomyConfig row in a database.
 */
export interface IGameConfigResolver {
  resolveForUser(userId: string): Promise<ResolvedMatchConfig>;
}
