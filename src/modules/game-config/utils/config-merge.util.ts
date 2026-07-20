import type { GameMode } from "@prisma/client";
import { GAME_MODES } from "@/modules/game-config/constants/field-registry";
import type {
  GameEconomyConfig,
  GeneralConfig,
  AntiCheatConfig,
  ModeProfile,
} from "@/modules/game-config/entities/game-economy-config.entity";
import type { UpsertDraftInput } from "@/modules/game-config/validators/game-economy-config.validator";

/** Deep-merges a partial admin patch onto a base config — used by `upsertDraft` so a PATCH-style body never wipes out untouched fields. */
export function mergeConfigPatch(
  base: Pick<GameEconomyConfig, "general" | "modes" | "antiCheat">,
  patch: UpsertDraftInput
): { general: GeneralConfig; modes: Record<GameMode, ModeProfile>; antiCheat: AntiCheatConfig } {
  const general: GeneralConfig = { ...base.general, ...patch.general };

  const modes = { ...base.modes } as Record<GameMode, ModeProfile>;
  for (const mode of GAME_MODES) {
    // The registry-driven zod schema validates every key's shape/bounds at
    // runtime; its dynamic key set doesn't type-check precisely against
    // ModeProfile, so the merge itself is a pragmatic cast rather than a
    // structurally-verified one.
    const modePatch = patch.modes?.[mode] as Partial<ModeProfile> | undefined;
    if (modePatch) modes[mode] = { ...modes[mode], ...modePatch } as ModeProfile;
  }

  const antiCheat: AntiCheatConfig = { ...base.antiCheat, ...patch.antiCheat };

  return { general, modes, antiCheat };
}
