import type { SessionEntity } from "@/modules/identity/entities/session.entity";

export interface CreateSessionRecord {
  id: string; // same as the JWT sessionId claim
  userId: string;
  familyId: string;
  ip: string | null;
  userAgent: string | null;
  os: string | null;
  browser: string | null;
  device: string | null;
  rememberMe: boolean;
  expiresAt: Date;
}

export interface IUserSessionRepository {
  create(data: CreateSessionRecord): Promise<SessionEntity>;
  findById(id: string): Promise<SessionEntity | null>;
  listByUser(userId: string): Promise<SessionEntity[]>;
  touch(id: string, at: Date): Promise<void>;
  revoke(id: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date, exceptId?: string): Promise<number>;
  revokeFamily(familyId: string, at: Date): Promise<number>;
}
