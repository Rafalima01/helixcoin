import type { GameEconomyConfig } from "@/modules/game-config/entities/game-economy-config.entity";

export const GAME_CONFIG_EVENTS = {
  draftSaved: "game-config.draft.saved",
  activated: "game-config.activated",
  restored: "game-config.restored",
  antiCheatFlagged: "game-config.anticheat.flagged",
} as const;

export interface GameConfigDraftSavedPayload {
  config: GameEconomyConfig;
}

export interface GameConfigActivatedPayload {
  config: GameEconomyConfig;
  previousVersion: number | null;
}

export interface GameConfigRestoredPayload {
  fromVersion: number;
  draft: GameEconomyConfig;
}

export interface AntiCheatFlaggedPayload {
  userId: string;
  matchId: string;
  reason: string;
  observed: Record<string, number>;
  limits: Record<string, number>;
}
