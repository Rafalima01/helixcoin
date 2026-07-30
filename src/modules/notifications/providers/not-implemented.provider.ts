import { ExternalServiceError } from "@/server/errors";
import type {
  PushProvider,
  PushPlatform,
  PushPayload,
  PushSendResult,
  PushSubscribeInput,
  ProviderHealthResult,
} from "@/modules/notifications/interfaces/push-provider.interface";
import type { PushSubscription } from "@/modules/notifications/entities/notifications.entity";

/**
 * Shared stand-in for every PushPlatform other than WEB_PUSH (FCM, APNS,
 * ONESIGNAL) — this phase only ships a functional Web Push integration.
 * Mirrors src/modules/payments/providers/not-implemented.provider.ts
 * exactly: every real operation throws, `healthCheck()` deliberately
 * returns OFFLINE instead of throwing so a future dispatcher-side health
 * filter can exclude these platforms without special-casing "not
 * implemented" as its own state.
 */
export class NotImplementedPushProvider implements PushProvider {
  constructor(readonly name: PushPlatform) {}

  private fail(): never {
    throw new ExternalServiceError(this.name, `Provedor de push ${this.name} ainda não implementado nesta fase`);
  }

  async send(_subscription: PushSubscription, _payload: PushPayload): Promise<PushSendResult> {
    this.fail();
  }

  async sendMany(_subscriptions: PushSubscription[], _payload: PushPayload): Promise<PushSendResult[]> {
    this.fail();
  }

  async subscribe(_input: PushSubscribeInput): Promise<{ valid: boolean }> {
    this.fail();
  }

  async unsubscribe(_subscriptionId: string): Promise<void> {
    this.fail();
  }

  async validateToken(_subscription: PushSubscription): Promise<boolean> {
    this.fail();
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    return { status: "OFFLINE", message: `${this.name} ainda não implementado` };
  }
}
