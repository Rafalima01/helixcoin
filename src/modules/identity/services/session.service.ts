import type { IUserSessionRepository } from "@/modules/identity/interfaces/session-repository.interface";
import type { SessionEntity } from "@/modules/identity/entities/session.entity";
import { revokeFamily } from "@/server/auth/tokens";
import { AuditService } from "@/server/audit";
import { eventBus } from "@/server/events";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { IDENTITY_EVENTS } from "@/modules/identity/events/identity.events";
import type { RequestMeta } from "@/modules/identity/services/auth.service";

export class SessionService {
  constructor(private readonly sessions: IUserSessionRepository) {}

  async listSessions(userId: string): Promise<SessionEntity[]> {
    return this.sessions.listByUser(userId);
  }

  /** Ends one device's session — familyId IS the Session.id (see session-repository.interface.ts), so this revokes both the durable row and the Redis-side rotation chain in one call. */
  async revokeSession(userId: string, sessionId: string, meta: RequestMeta): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (!session) throw new NotFoundError("Session");
    if (session.userId !== userId) throw new ForbiddenError("Esta sessão não pertence a este usuário");

    await revokeFamily(session.familyId);
    await this.sessions.revoke(sessionId, new Date());

    eventBus.publish(IDENTITY_EVENTS.sessionRevoked, { userId, sessionId }, userId);
    await AuditService.record({
      actorId: userId,
      actorType: "USER",
      action: "auth.session.revoked",
      entityType: "Session",
      entityId: sessionId,
      sessionId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /** "Log out everywhere" — revokes every other active session, optionally excluding the caller's own current one. */
  async revokeAllSessions(userId: string, meta: RequestMeta, exceptSessionId?: string): Promise<number> {
    const active = await this.sessions.listByUser(userId);
    let count = 0;
    for (const s of active) {
      if (s.status !== "ACTIVE" || s.id === exceptSessionId) continue;
      await revokeFamily(s.familyId);
      await this.sessions.revoke(s.id, new Date());
      count++;
    }

    eventBus.publish(IDENTITY_EVENTS.sessionRevoked, { userId, sessionId: "*" }, userId);
    await AuditService.record({
      actorId: userId,
      actorType: "USER",
      action: "auth.session.revoked_all",
      entityType: "Session",
      after: { count, exceptSessionId: exceptSessionId ?? null },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return count;
  }
}
