import { DIFFICULTY_PRESETS, MODE_FIELDS, type DifficultyPreset } from "@/modules/game-config/constants/field-registry";
import type { ModeProfile } from "@/modules/game-config/entities/game-economy-config.entity";

type PresetFieldKey = keyof DifficultyPreset["values"];
const PRESET_FIELD_KEYS = Object.keys(DIFFICULTY_PRESETS[0].values) as PresetFieldKey[];

function fieldRange(key: PresetFieldKey): { min: number; max: number } {
  const def = MODE_FIELDS.find((f) => f.key === key);
  return { min: def?.min ?? 0, max: def?.max ?? 1 };
}

/** True when every difficulty-relevant field in `profile` exactly equals `preset`'s values — i.e. nothing has been hand-edited since the preset was applied. */
export function matchesPreset(profile: ModeProfile, preset: DifficultyPreset): boolean {
  return PRESET_FIELD_KEYS.every((key) => Number(profile[key]) === preset.values[key]);
}

/** The preset currently active for this profile, or `null` ("Personalizado") once any field has been hand-edited away from it. */
export function currentPreset(profile: ModeProfile): DifficultyPreset | null {
  return DIFFICULTY_PRESETS.find((p) => matchesPreset(profile, p)) ?? null;
}

/**
 * Closest of the 5 tuned presets to an arbitrary (possibly hand-edited)
 * profile — each field normalized by its registry min/max range before
 * measuring distance, since gravity/ballSpeed/dangerChance/etc. live on very
 * different scales. Used to pick a difficulty color/label for a
 * "Personalizado" profile without a bespoke scoring formula: whichever
 * tuned preset it most resembles.
 */
export function nearestPreset(profile: ModeProfile): DifficultyPreset {
  let best = DIFFICULTY_PRESETS[0];
  let bestDistance = Infinity;

  for (const preset of DIFFICULTY_PRESETS) {
    let distance = 0;
    for (const key of PRESET_FIELD_KEYS) {
      const { min, max } = fieldRange(key);
      const range = max - min || 1;
      const delta = (Number(profile[key] ?? preset.values[key]) - preset.values[key]) / range;
      distance += delta * delta;
    }
    if (distance < bestDistance) {
      bestDistance = distance;
      best = preset;
    }
  }

  return best;
}
