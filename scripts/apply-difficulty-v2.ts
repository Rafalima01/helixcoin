/**
 * Pushes the "Dificuldade V2" ladder (see
 * src/modules/game-config/constants/field-registry.ts) into a new ACTIVE
 * GameEconomyConfig version, through the normal draft->activate service flow —
 * never a raw DB edit, so it lands in the versioned config history and the
 * audit log exactly like an admin doing it by hand in /admin/rtp.
 *
 * WHY THIS EXISTS AT ALL: `MODE_FIELDS[].defaults` only seeds the very first
 * config version. Any environment that already has an ACTIVE version keeps
 * serving that stored payload forever, so shipping the field-registry change
 * alone updates nothing for real players. This script is what closes that gap.
 *
 * Safe to run on EVERY deploy — it compares the active config against the
 * registry first and exits without writing when they already agree, so it
 * never piles up no-op versions. It also deliberately touches ONLY `modes`:
 * `general` (betMin/betMax/targetMultiplierDefault/hardModeBalanceThreshold/
 * quickBetAmounts) and `antiCheat` are commercial/security settings an
 * operator may have tuned, and a difficulty migration has no business
 * resetting them.
 *
 * What it does NOT do: clean the ~28 legacy keys some older payloads still
 * carry (ballSize, friction, cameraFov, elasticity, ...). `mergeConfigPatch`
 * merges a patch onto the stored profile (`{ ...stored, ...patch }`) rather
 * than replacing it, so unknown keys survive every activation. They are inert
 * — `applyEngineOverrides` only ever reads the registry's own keys — so this
 * is dead weight in the JSON column, not a behaviour risk, and clearing it
 * would mean changing merge semantics that every other config write depends
 * on. Left alone deliberately.
 */
import { PrismaClient } from "@prisma/client";
import { gameConfigContainer } from "@/modules/game-config/container";
import { MODE_FIELDS, GAME_MODES } from "@/modules/game-config/constants/field-registry";
import type { ModeProfile } from "@/modules/game-config/entities/game-economy-config.entity";

const prisma = new PrismaClient();

/** The target profile for one mode, straight from the registry. */
function targetProfile(mode: (typeof GAME_MODES)[number]): ModeProfile {
  const profile: ModeProfile = {};
  for (const field of MODE_FIELDS) profile[field.key] = field.defaults[mode];
  return profile;
}

/**
 * True when the stored profile already carries every registry value. Compares
 * only the registry's own keys on purpose — a stored payload may still hold
 * legacy keys, and their presence alone is not a reason to cut a new version.
 */
function alreadyMatches(stored: ModeProfile | undefined, target: ModeProfile): boolean {
  if (!stored) return false;
  return Object.entries(target).every(([key, value]) => stored[key] === value);
}

async function main() {
  const { gameConfigService } = gameConfigContainer;

  const active = await gameConfigService.getActive().catch(() => null);
  if (!active) {
    // Fresh install: prisma/seed.ts bootstraps v1 straight from the registry,
    // so it is already on the new ladder and there is nothing to migrate.
    console.log("[difficulty-v2] Nenhuma versão ativa (instalação nova) — o seed já usa o registry. Nada a fazer.");
    return;
  }

  const targets = Object.fromEntries(GAME_MODES.map((mode) => [mode, targetProfile(mode)]));
  const stale = GAME_MODES.filter((mode) => !alreadyMatches(active.modes[mode], targets[mode]));

  if (stale.length === 0) {
    console.log(`[difficulty-v2] v${active.version} já está na escada nova (${GAME_MODES.join("/")}). Nada a fazer.`);
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    // Not a hard failure: a deploy shouldn't break because the platform has no
    // admin yet. Loud enough that whoever reads the log knows to run it later.
    console.warn("[difficulty-v2] Nenhum SUPER_ADMIN encontrado — não há autor para a auditoria. Pulando (rode de novo após criar o admin).");
    return;
  }

  console.log(`[difficulty-v2] v${active.version} desatualizada em: ${stale.join(", ")}. Criando nova versão...`);
  for (const mode of stale) {
    const before = active.modes[mode] ?? {};
    const diff = Object.entries(targets[mode])
      .filter(([key, value]) => before[key] !== value)
      .map(([key, value]) => `${key}: ${before[key] ?? "—"} -> ${value}`);
    console.log(`  ${mode}: ${diff.join(", ")}`);
  }

  const actor = { actorId: admin.id, actorType: "USER" as const, actorRole: admin.role };
  const draft = await gameConfigService.upsertDraft(
    {
      description: "Dificuldade V2 — escada real entre os modos (abertura, rampa de perigo, ritmo)",
      modes: targets,
    },
    actor
  );
  const activated = await gameConfigService.activate(actor, draft.id);

  console.log(`[difficulty-v2] GameEconomyConfig v${activated.version} ativada.`);
  for (const mode of GAME_MODES) {
    const p = activated.modes[mode];
    const gapDegrees = (Number(p.gapWidth) * 360) / Number(p.segmentsPerPlatform);
    console.log(
      `  ${mode.padEnd(6)} abertura=${gapDegrees.toFixed(0)}° ` +
        `gravity=${p.gravity} bounce=${p.bounceForce} speed=${p.ballSpeed} ` +
        `maxRed=${p.maxDangerSegments} protegidas=${p.protectedPlatforms}`
    );
  }
}

main()
  .catch((e) => {
    console.error("[difficulty-v2] falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
