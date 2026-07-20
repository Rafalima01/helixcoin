import type { SessionStatus } from "@prisma/client";

export interface SessionEntity {
  id: string;
  userId: string;
  familyId: string;
  status: SessionStatus;
  ip: string | null;
  userAgent: string | null;
  os: string | null;
  browser: string | null;
  device: string | null;
  location: string | null;
  rememberMe: boolean;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export function isSessionActive(session: SessionEntity, now = new Date()): boolean {
  return session.status === "ACTIVE" && !session.revokedAt && session.expiresAt > now;
}
