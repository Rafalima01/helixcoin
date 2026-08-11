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
  GameEconomyConfig,
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

/** Pulls a numeric value back inside [min, max] when both bounds are registered and it strayed outside — a no-op for anything already in range, for booleans, or for a field with no bounds. */
function clamp(value: number | boolean, min?: number, max?: number): number | boolean {
  if (typeof value !== "number" || min === undefined || max === undefined) return value;
  return Math.min(max, Math.max(min, value));
}

/**
 * Backfills any key registered in field-registry.ts but missing from a
 * PERSISTED config (general/modes/antiCheat are Json columns with no
 * compile-time shape) with that key's registry default, and clamps any key
 * that IS present back inside that field's current [min, max] — never
 * touches a value that's already both present and in range.
 *
 * Two distinct ways a persisted row can go stale, both handled here:
 * 1) A version saved before a new field existed (e.g. `rotationSpeed`,
 *    added after DEMO/NORMAL/HARD were already active) stays missing that
 *    key forever.
 * 2) A version saved while a field's bounds were looser (or unbounded) keeps
 *    whatever value it was given even after the registry's min/max is
 *    tightened later — e.g. a draft saved with `rotationSpeed: 16` before
 *    this field's max was fixed at 2 stays at 16 forever, since bounds are
 *    only enforced at WRITE time (Zod on `upsertDraft`, `validateFullConfig`
 *    on `activate`), never re-checked on read.
 *
 * Either case makes `validateFullConfig` reject EVERY mode at activation —
 * not just the mode an admin is actively editing, since the untouched modes
 * carry the same stale value or missing key. Applied at the repository read
 * boundary so every existing row self-heals on load, with no migration
 * script and no risk to any value that was already valid.
 */
export function withRegistryDefaults(
  partial: Pick<GameEconomyConfig, "general" | "modes" | "antiCheat">
): Pick<GameEconomyConfig, "general" | "modes" | "antiCheat"> {
  const defaultModes = buildDefaultModes();
  const modes = {} as Record<GameMode, ModeProfile>;
  for (const mode of GAME_MODES) {
    const merged = { ...defaultModes[mode], ...(partial.modes?.[mode] ?? {}) };
    const profile: ModeProfile = {};
    for (const field of MODE_FIELDS) profile[field.key] = clamp(merged[field.key], field.min, field.max);
    modes[mode] = profile;
  }

  const general = { ...buildDefaultGeneral(), ...partial.general };
  for (const field of GENERAL_FIELDS) {
    general[field.key] = clamp(general[field.key], field.min, field.max) as number;
  }

  const antiCheat = { ...buildDefaultAntiCheat(), ...partial.antiCheat };
  for (const field of ANTI_CHEAT_FIELDS) {
    antiCheat[field.key] = clamp(antiCheat[field.key], field.min, field.max) as number;
  }

  return { general, modes, antiCheat };
}
