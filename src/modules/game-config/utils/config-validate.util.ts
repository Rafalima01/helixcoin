import type { GameMode } from "@prisma/client";
import {
  MODE_FIELDS,
  GENERAL_FIELDS,
  ANTI_CHEAT_FIELDS,
  GAME_MODES,
} from "@/modules/game-config/constants/field-registry";
import type {
  GeneralConfig,
  AntiCheatConfig,
  ModeProfile,
} from "@/modules/game-config/entities/game-economy-config.entity";
import { ValidationError } from "@/server/errors";

interface ValidatableConfig {
  general: GeneralConfig;
  modes: Record<GameMode, ModeProfile>;
  antiCheat: AntiCheatConfig;
}

/**
 * Full-config validation — run before a version is ACTIVATED (not on every
 * partial draft save, which would reject an in-progress edit that only
 * touches one section). Checks every registry key is present and within
 * bounds, plus a couple of cross-field sanity rules the registry can't
 * express on its own (min < max pairs).
 */
export function validateFullConfig(config: ValidatableConfig): void {
  const errors: string[] = [];

  for (const field of GENERAL_FIELDS) {
    const value = config.general[field.key];
    if (typeof value !== "number" || Number.isNaN(value) || value < field.min || value > field.max) {
      errors.push(`general.${field.key}`);
    }
  }
  if (!Array.isArray(config.general.quickBetAmounts) || config.general.quickBetAmounts.length === 0) {
    errors.push("general.quickBetAmounts");
  }
  if (config.general.betMin >= config.general.betMax) {
    errors.push("general.betMin deve ser menor que general.betMax");
  }
  if (config.general.goalMultiplierMin >= config.general.goalMultiplierMax) {
    errors.push("general.goalMultiplierMin deve ser menor que general.goalMultiplierMax");
  }

  for (const mode of GAME_MODES) {
    const profile = config.modes[mode];
    if (!profile) {
      errors.push(`modes.${mode}`);
      continue;
    }
    for (const field of MODE_FIELDS) {
      const value = profile[field.key];
      if (field.kind === "boolean") {
        if (typeof value !== "boolean") errors.push(`modes.${mode}.${field.key}`);
        continue;
      }
      if (
        typeof value !== "number" ||
        Number.isNaN(value) ||
        (field.min !== undefined && value < field.min) ||
        (field.max !== undefined && value > field.max)
      ) {
        errors.push(`modes.${mode}.${field.key}`);
      }
    }
  }

  for (const field of ANTI_CHEAT_FIELDS) {
    const value = config.antiCheat[field.key];
    if (typeof value !== "number" || Number.isNaN(value) || value < field.min || value > field.max) {
      errors.push(`antiCheat.${field.key}`);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError("Configuração inválida — campos fora dos limites permitidos", {
      fields: errors,
    });
  }
}
