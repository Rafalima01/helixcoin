// One-off: pushes RTP11's recalibrated NORMAL/HARD mode defaults (see
// src/modules/game-config/constants/field-registry.ts) into a new ACTIVE
// GameEconomyConfig version via the normal draft->activate service flow —
// never a raw DB edit, so this shows up in the versioned config history and
// audit log exactly like an admin doing it by hand in /admin/rtp. Run once
// after deploying the field-registry.ts change; safe to delete afterward.
import { PrismaClient } from "@prisma/client";
import { gameConfigContainer } from "@/modules/game-config/container";
import { MODE_FIELDS } from "@/modules/game-config/constants/field-registry";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" } });
  if (!admin) {
    console.log("No SUPER_ADMIN found — nothing to activate as. Skipping.");
    return;
  }

  const normal: Record<string, number | boolean> = {};
  const hard: Record<string, number | boolean> = {};
  for (const field of MODE_FIELDS) {
    normal[field.key] = field.defaults.NORMAL;
    hard[field.key] = field.defaults.HARD;
  }

  const actor = { actorId: admin.id, actorType: "USER" as const };
  const draft = await gameConfigContainer.gameConfigService.upsertDraft(
    {
      description: "RTP11 — recalibração de dificuldade (NORMAL/HARD mais exigentes)",
      modes: { NORMAL: normal, HARD: hard },
    },
    actor
  );
  const activated = await gameConfigContainer.gameConfigService.activate(actor, draft.id);
  console.log(`GameEconomyConfig v${activated.version} activated with RTP11 defaults.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
