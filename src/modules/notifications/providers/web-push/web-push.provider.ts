import webpush from "web-push";
import { env } from "@/server/config/env";
import type {
  PushProvider,
  PushPayload,
  PushSendResult,
  PushSubscribeInput,
  ProviderHealthResult,
} from "@/modules/notifications/interfaces/push-provider.interface";
import type { PushSubscription } from "@/modules/notifications/entities/notifications.entity";

let vapidConfigured = false;
function ensureVapidConfigured(): void {
  if (vapidConfigured) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

/**
 * The only functional PushProvider this phase. Standard Web Push protocol
 * (RFC 8030) via the `web-push` package — works in every browser that
 * supports the Push API (Chrome/Firefox/Edge everywhere, Safari on iOS
 * 16.4+ for a PWA added to the home screen). A 404/410 response means the
 * push service has permanently discarded the subscription (user revoked
 * permission, uninstalled, etc.) — `send()` surfaces that as
 * `expired: true` so the caller (the queue worker) marks the row EXPIRED
 * instead of retrying forever.
 */
export class WebPushProvider implements PushProvider {
  readonly name = "WEB_PUSH" as const;

  async send(subscription: PushSubscription, payload: PushPayload): Promise<PushSendResult> {
    ensureVapidConfigured();
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload)
      );
      return { success: true };
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      const expired = statusCode === 404 || statusCode === 410;
      return {
        success: false,
        expired,
        errorMessage: err instanceof Error ? err.message : "unknown web-push error",
      };
    }
  }

  async sendMany(subscriptions: PushSubscription[], payload: PushPayload): Promise<PushSendResult[]> {
    return Promise.all(subscriptions.map((s) => this.send(s, payload)));
  }

  async subscribe(input: PushSubscribeInput): Promise<{ valid: boolean }> {
    return { valid: Boolean(input.endpoint && input.p256dh && input.auth) };
  }

  async unsubscribe(): Promise<void> {
    // No server-side call needed for Web Push — revocation is purely local
    // (PushSubscriptionRepository.updateStatus REVOKED). Present to satisfy
    // the PushProvider contract for providers (FCM/APNs) that do need one.
  }

  async validateToken(subscription: PushSubscription): Promise<boolean> {
    return Boolean(subscription.endpoint && subscription.p256dh && subscription.auth);
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    ensureVapidConfigured();
    return { status: "ONLINE" };
  }
}
