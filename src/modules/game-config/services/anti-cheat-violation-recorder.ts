import { prisma } from "@/lib/prisma";
import { AuditService } from "@/server/audit";
import { GAME_CONFIG_EVENTS } from "@/modules/game-config/events/game-config.events";
import { eventBus } from "@/server/events";
import { createChildLogger } from "@/server/logger";
import type { CheckResolveResult } from "@/modules/game-config/services/anti-cheat.service";

const logger = createChildLogger({ module: "anti-cheat-violation-recorder" });

const FLAG_TAG = "flagged:anticheat";
/** Roles that can act on a flagged match — same set as `game.manage`'s grantees in prisma/seed.ts. */
const NOTIFY_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATOR"] as const;

/**
 * Side effects for a flagged `AntiCheatService.check()` result: audit trail
 * (searchable in the existing /admin/audit page by action "anticheat."),
 * a Notification row per admin/operator, and a `"flagged:anticheat"` tag on
 * the user for quick identification elsewhere in the backoffice. Uses
 * Prisma directly — same precedent as AuditService itself, an
 * infra-level writer rather than a business-logic repository consumer.
 */
export async function recordAntiCheatViolation(input: {
  userId: string;
  matchId: string;
  result: CheckResolveResult;
  limits: Record<string, number>;
}): Promise<void> {
  const { userId, matchId, result } = input;

  await AuditService.record({
    actorId: userId,
    actorType: "USER",
    action: `anticheat.flagged.${result.reason ?? "unknown"}`,
    entityType: "Match",
    entityId: matchId,
    before: null,
    after: { reason: result.reason, observed: result.observed, limits: input.limits },
  });

  eventBus.publish(
    GAME_CONFIG_EVENTS.antiCheatFlagged,
    {
      userId,
      matchId,
      reason: result.reason ?? "unknown",
      observed: result.observed ?? {},
      limits: input.limits,
    },
    matchId
  );

  try {
    const [admins, user] = await Promise.all([
      prisma.user.findMany({ where: { role: { in: [...NOTIFY_ROLES] } }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { tags: true } }),
    ]);

    if (user && !user.tags.includes(FLAG_TAG)) {
      await prisma.user.update({ where: { id: userId }, data: { tags: { push: FLAG_TAG } } });
    }

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "anticheat",
          title: "Partida sinalizada pelo anti-cheat",
          message: `Partida ${matchId} sinalizada: ${result.reason ?? "motivo desconhecido"}.`,
        })),
      });
    }
  } catch (err) {
    // Never let notification/tagging fail the resolve request itself — the
    // audit record above is already durable, which is what matters most.
    logger.error({ err, userId, matchId }, "failed to write anti-cheat side effects");
  }
}
