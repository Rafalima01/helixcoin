import { prisma } from "@/lib/prisma";
import type { AuditLogResponseDto } from "@/modules/identity/dto/audit.dto";

export interface LoginHistoryQuery {
  page: number;
  pageSize: number;
}

/**
 * Login history is a filtered read over the append-only AuditLog table
 * (action prefix "auth.") rather than a separate model — AuditLog already
 * carries every field a login-history view needs (ip/userAgent/sessionId/
 * actorId/createdAt), and duplicating it would risk the two drifting apart.
 */
export class LoginHistoryService {
  async listForUser(userId: string, query: LoginHistoryQuery): Promise<{ items: AuditLogResponseDto[]; total: number }> {
    const where = {
      actorId: userId,
      action: { startsWith: "auth." },
    };

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorType: row.actorType,
        actorRole: row.actorRole,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        before: row.before,
        after: row.after,
        ip: row.ip,
        userAgent: row.userAgent,
        sessionId: row.sessionId,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
    };
  }
}
