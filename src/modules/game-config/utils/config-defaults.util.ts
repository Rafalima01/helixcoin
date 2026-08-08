import type { GameMode } from "@prisma/client";
import {
  MODE_FIELDS,
  GENERAL_FIELDS,
  ANTI_CHEAT_FIELDS,
  GAME_MODES,
  DEFAULT_QUICK_BET_AMOUNTS,
  GOAL_MULTIPLIER_MIN,
  GOAL_MULTIPLIER_MAX,
} from "@/modules/game-config/constants/field-registry";
import type {
  GeneralConfig,
  AntiCheatConfig,
  ModeProfile,
} from "@/modules/game-config/entities/game-economy-config.entity";

export function buildDefaultGeneral(): GeneralConfig {
  const numeric = Object.fromEntries(GENERAL_FIELDS.map((f) => [f.key, f.default])) as Record<
    (typeof GENERAL_FIELDS)[number]["key"],
    number
  >;
  return {
    ...numeric,
    quickBetAmounts: [...DEFAULT_QUICK_BET_AMOUNTS],
    // Not admin-editable anymore (see the GeneralFieldKey note in
    // field-registry) — kept on the entity so `goalSnapshot` and old config
    // versions still carry the values they always did.
    goalMultiplierMin: GOAL_MULTIPLIER_MIN,
    goalMultiplierMax: GOAL_MULTIPLIER_MAX,
    goalAllowFixed: true,
    goalAllowDynamic: false,
  };
}

export function buildDefaultModes(): Record<GameMode, ModeProfile> {
  const modes = {} as Record<GameMode, ModeProfile>;
  for (const mode of GAME_MODES) {
    const profile: ModeProfile = {};
    for (const field of MODE_FIELDS) profile[field.key] = field.defaults[mode];
    modes[mode] = profile;
  }
  return modes;
}

export function buildDefaultAntiCheat(): AntiCheatConfig {
  return Object.fromEntries(ANTI_CHEAT_FIELDS.map((f) => [f.key, f.default])) as unknown as AntiCheatConfig;
}
