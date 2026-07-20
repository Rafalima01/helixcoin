import type { GameMode, ConfigStatus } from "@prisma/client";

/** One mode's full set of physics/generation/camera knobs — keys come from field-registry's MODE_FIELDS. */
export type ModeProfile = Record<string, number | boolean>;

export interface GeneralConfig {
  targetMultiplierDefault: number;
  /** Cents. */
  betMin: number;
  /** Cents. */
  betMax: number;
  /** Cents, ordered — powers the quick-bet button row. */
  quickBetAmounts: number[];
  /** Cents. 0 disables the Hard-mode balance trigger entirely. */
  hardModeBalanceThreshold: number;
  goalMultiplierMin: number;
  goalMultiplierMax: number;
  goalAllowFixed: boolean;
  goalAllowDynamic: boolean;
}

export interface AntiCheatConfig {
  maxPlatformsPerSecond: number;
  minSecondsToGoal: number;
  minSecondsBeforeCashout: number;
  maxVerticalSpeed: number;
  maxHorizontalSpeed: number;
  maxAcceleration: number;
  maxCollisionsPerSecond: number;
}

/** Domain entity — see this module's README for the versioning/status lifecycle. */
export interface GameEconomyConfig {
  id: string;
  version: number;
  status: ConfigStatus;
  description: string | null;
  general: GeneralConfig;
  modes: Record<GameMode, ModeProfile>;
  antiCheat: AntiCheatConfig;
  createdById: string;
  createdAt: Date;
  activatedAt: Date | null;
}

export interface GameEconomyConfigSummary {
  id: string;
  version: number;
  status: ConfigStatus;
  description: string | null;
  /** Included so the version history can show "Baseado no preset" per mode without a second fetch. */
  modes: Record<GameMode, ModeProfile>;
  createdById: string;
  createdAt: Date;
  activatedAt: Date | null;
}
