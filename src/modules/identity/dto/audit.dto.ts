import type { AuditActorType, Role } from "@prisma/client";

export type { AuditSearchQuery } from "@/server/audit";

export interface AuditLogResponseDto {
  id: string;
  actorId: string | null;
  actorType: AuditActorType;
  actorRole: Role | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  sessionId: string | null;
  createdAt: string;
}
