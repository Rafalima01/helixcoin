import type { SessionEntity } from "@/modules/identity/entities/session.entity";
import type {
  CreateSessionRecord,
  IUserSessionRepository,
} from "@/modules/identity/interfaces/session-repository.interface";

export class InMemoryUserSessionRepository implements IUserSessionRepository {
  private readonly sessions = new Map<string, SessionEntity>();

  async create(data: CreateSessionRecord): Promise<SessionEntity> {
    const now = new Date();
    const session: SessionEntity = {
      id: data.id,
      userId: data.userId,
      familyId: data.familyId,
      status: "ACTIVE",
      ip: data.ip,
      userAgent: data.userAgent,
      os: data.os,
      browser: data.browser,
      device: data.device,
      location: null,
      rememberMe: data.rememberMe,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: data.expiresAt,
      revokedAt: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findById(id: string): Promise<SessionEntity | null> {
    return this.sessions.get(id) ?? null;
  }

  async listByUser(userId: string): Promise<SessionEntity[]> {
    return [...this.sessions.values()]
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
  }

  async touch(id: string, at: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, lastActivityAt: at });
  }

  async revoke(id: string, at: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session) this.sessions.set(id, { ...session, status: "REVOKED", revokedAt: at });
  }

  async revokeAllForUser(userId: string, at: Date, exceptId?: string): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.status === "ACTIVE" && session.id !== exceptId) {
        this.sessions.set(session.id, { ...session, status: "REVOKED", revokedAt: at });
        count++;
      }
    }
    return count;
  }

  async revokeFamily(familyId: string, at: Date): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.familyId === familyId && session.status === "ACTIVE") {
        this.sessions.set(session.id, { ...session, status: "REVOKED", revokedAt: at });
        count++;
      }
    }
    return count;
  }
}
