import { ForbiddenError, NotFoundError } from "@/server/errors";
import type { IPushSubscriptionRepository } from "@/modules/notifications/interfaces/push-subscription-repository.interface";
import type { PushSubscription } from "@/modules/notifications/entities/notifications.entity";
import type { SubscribeInput } from "@/modules/notifications/validators/notifications.validator";

/** Device registration for push — "um usuário pode ter vários dispositivos" is enforced by the repository's upsert-by-[userId,deviceId] semantics, not here. */
export class PushSubscriptionService {
  constructor(private readonly subscriptions: IPushSubscriptionRepository) {}

  async subscribe(userId: string, input: SubscribeInput): Promise<PushSubscription> {
    return this.subscriptions.upsert({
      userId,
      deviceId: input.deviceId,
      browser: input.browser ?? null,
      os: input.os ?? null,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    });
  }

  async listMyDevices(userId: string): Promise<PushSubscription[]> {
    return this.subscriptions.listByUserId(userId);
  }

  /** Soft — flips to REVOKED rather than deleting, so PushNotificationLog history for this device survives. */
  async unsubscribe(userId: string, subscriptionId: string): Promise<void> {
    const subscription = await this.subscriptions.findById(subscriptionId);
    if (!subscription) throw new NotFoundError("Dispositivo");
    if (subscription.userId !== userId) throw new ForbiddenError();
    await this.subscriptions.updateStatus(subscriptionId, "REVOKED");
  }
}
