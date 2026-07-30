import type { PushSubscription, PushSubscriptionStatus } from "@/modules/notifications/entities/notifications.entity";

export interface UpsertPushSubscriptionInput {
  userId: string;
  deviceId: string;
  browser?: string | null;
  os?: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Service layer depends on this interface only, never on `@/lib/prisma` directly — see repositories/ for the Prisma + in-memory implementations. */
export interface IPushSubscriptionRepository {
  /** Upsert by [userId, deviceId] — the same browser re-subscribing updates the existing row instead of duplicating. */
  upsert(input: UpsertPushSubscriptionInput): Promise<PushSubscription>;
  findById(id: string): Promise<PushSubscription | null>;
  /** ACTIVE rows only — what the dispatcher fans out a push to. */
  findActiveByUserId(userId: string): Promise<PushSubscription[]>;
  /** Every row regardless of status — "meus dispositivos" listing. */
  listByUserId(userId: string): Promise<PushSubscription[]>;
  updateStatus(id: string, status: PushSubscriptionStatus): Promise<PushSubscription>;
}
