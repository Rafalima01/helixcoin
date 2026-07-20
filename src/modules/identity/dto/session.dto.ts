import { isSessionActive, type SessionEntity } from "@/modules/identity/entities/session.entity";

export interface SessionResponseDto {
  id: string;
  ip: string | null;
  os: string | null;
  browser: string | null;
  device: string | null;
  location: string | null;
  rememberMe: boolean;
  active: boolean;
  current: boolean;
  createdAt: string;
  lastActivityAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export function toSessionResponseDto(session: SessionEntity, currentSessionId: string | null): SessionResponseDto {
  return {
    id: session.id,
    ip: session.ip,
    os: session.os,
    browser: session.browser,
    device: session.device,
    location: session.location,
    rememberMe: session.rememberMe,
    active: isSessionActive(session),
    current: session.id === currentSessionId,
    createdAt: session.createdAt.toISOString(),
    lastActivityAt: session.lastActivityAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString() ?? null,
  };
}
