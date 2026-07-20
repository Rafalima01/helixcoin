import type { NextRequest } from "next/server";
import type { AuditActorType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createChildLogger } from "@/server/logger";

const logger = createChildLogger({ module: "audit" });

export interface AuditRecordInput {
  actorId?: string | null;
  actorType: AuditActorType;
  actorRole?: Role | null;
  /** Short, stable, greppable — e.g. "wallet.balance.adjust", not a sentence. */
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
}

/**
 * Append-only audit trail writer — the ONLY place AuditLog rows get
 * created (see the model's doc comment in schema.prisma). Every mutating
 * service call in a future module should end with one `AuditService.record`
 * call describing what changed, for whom, and why the actor was allowed to.
 *
 * A failure to write an audit row must never fail the operation it's
 * describing (losing the audit trail is bad; losing the user's deposit
 * because the audit table hiccupped is worse) — errors are logged, not
 * thrown.
 */
export interface AuditSearchQuery {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  page: number;
  pageSize: number;
}

export const AuditService = {
  async record(input: AuditRecordInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? null,
          actorType: input.actorType,
          actorRole: input.actorRole ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          before: toJsonInput(input.before),
          after: toJsonInput(input.after),
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          sessionId: input.sessionId ?? null,
        },
      });
    } catch (err) {
      logger.error(
        { err, action: input.action, entityType: input.entityType },
        "Failed to write audit log"
      );
    }
  },

  /** Read path for the immutable trail — never exposes a way to mutate or delete rows. */
  async search(query: AuditSearchQuery) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: { startsWith: query.action } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  },
};

function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  // Round-trips through JSON so class instances / undefined-valued keys /
  // Dates become plain JSON-safe values before Prisma serializes them.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Pulls (ip, userAgent) off a request — the two fields every audit call site needs from it. */
export function extractRequestMeta(req: NextRequest): {
  ip: string | null;
  userAgent: string | null;
} {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const userAgent = req.headers.get("user-agent");
  return { ip, userAgent };
}
