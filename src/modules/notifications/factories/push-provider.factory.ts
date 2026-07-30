import { WebPushProvider } from "@/modules/notifications/providers/web-push/web-push.provider";
import { NotImplementedPushProvider } from "@/modules/notifications/providers/not-implemented.provider";
import type { PushProvider, PushPlatform } from "@/modules/notifications/interfaces/push-provider.interface";

/**
 * Sole job: resolve the right PushProvider for a platform. Every
 * PushSubscription created this phase comes from the browser's Push API
 * (`/api/push/subscribe`), so it's always WEB_PUSH in practice — there's no
 * `platform` column on PushSubscription yet because nothing else can create
 * a row. When a mobile app starts registering FCM/APNs tokens, that column
 * (and the branch below) is the only place that needs to change; the
 * dispatcher/queue worker never call a concrete provider directly.
 */
export class PushProviderFactory {
  static forPlatform(platform: PushPlatform): PushProvider {
    if (platform === "WEB_PUSH") return new WebPushProvider();
    return new NotImplementedPushProvider(platform);
  }
}
