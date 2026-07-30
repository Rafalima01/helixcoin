import type { PushSubscription } from "@/modules/notifications/entities/notifications.entity";

export type PushPlatform = "WEB_PUSH" | "FCM" | "APNS" | "ONESIGNAL";

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  deepLink?: string;
  priority?: "normal" | "high";
  /** The NotificationCategory string — carried through so the client-side Service Worker can route/style it, and so history/click beacons can correlate back. */
  category: string;
  /** The PushNotificationLog row id this send corresponds to — echoed back by the client's delivered/clicked beacons. */
  logId: string;
}

export interface PushSendResult {
  success: boolean;
  /** Set when the provider indicates the subscription is gone for good (HTTP 404/410) — caller marks it EXPIRED, never retries it. */
  expired?: boolean;
  errorMessage?: string;
}

export interface PushSubscribeInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface ProviderHealthResult {
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  message?: string;
}

/**
 * Every push provider (WebPush, FCM, APNs, OneSignal) implements this
 * exactly — NotificationDispatcher and the queue worker only ever depend on
 * this interface, never on a concrete provider. Deliberately mirrors
 * PaymentProvider (src/modules/payments/interfaces/payment-provider.interface.ts)
 * — same "SDK any future provider must implement" contract, same
 * NotImplemented-fallback pattern (see providers/not-implemented.provider.ts).
 * Only WebPushProvider is functional this phase.
 */
export interface PushProvider {
  readonly name: PushPlatform;
  send(subscription: PushSubscription, payload: PushPayload): Promise<PushSendResult>;
  sendMany(subscriptions: PushSubscription[], payload: PushPayload): Promise<PushSendResult[]>;
  /** Validates the shape of a subscription just received from the browser — doesn't persist anything. */
  subscribe(input: PushSubscribeInput): Promise<{ valid: boolean }>;
  unsubscribe(subscriptionId: string): Promise<void>;
  validateToken(subscription: PushSubscription): Promise<boolean>;
  healthCheck(): Promise<ProviderHealthResult>;
}
