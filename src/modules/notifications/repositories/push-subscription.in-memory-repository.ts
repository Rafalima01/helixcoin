import type { IPushSubscriptionRepository, UpsertPushSubscriptionInput } from "@/modules/notifications/interfaces/push-subscription-repository.interface";
import type { PushSubscription, PushSubscriptionStatus } from "@/modules/notifications/entities/notifications.entity";

export class InMemoryPushSubscriptionRepository implements IPushSubscriptionRepository {
  private readonly rows = new Map<string, PushSubscription>();

  async upsert(input: UpsertPushSubscriptionInput): Promise<PushSubscription> {
    const existing = [...this.rows.values()].find((r) => r.userId === input.userId && r.deviceId === input.deviceId);
    const now = new Date();
    if (existing) {
      const updated: PushSubscription = {
        ...existing,
        browser: input.browser ?? null,
        os: input.os ?? null,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        status: "ACTIVE",
        updatedAt: now,
      };
      this.rows.set(updated.id, updated);
      return updated;
    }
    const row: PushSubscription = {
      id: crypto.randomUUID(),
      userId: input.userId,
      deviceId: input.deviceId,
      browser: input.browser ?? null,
      os: input.os ?? null,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(row.id, row);
    return row;
  }

  async findById(id: string): Promise<PushSubscription | null> {
    return this.rows.get(id) ?? null;
  }

  async findActiveByUserId(userId: string): Promise<PushSubscription[]> {
    return [...this.rows.values()].filter((r) => r.userId === userId && r.status === "ACTIVE");
  }

  async listByUserId(userId: string): Promise<PushSubscription[]> {
    return [...this.rows.values()].filter((r) => r.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateStatus(id: string, status: PushSubscriptionStatus): Promise<PushSubscription> {
    const existing = this.rows.get(id);
    if (!existing) throw new Error(`PushSubscription ${id} not found`);
    const updated: PushSubscription = { ...existing, status, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }
}
