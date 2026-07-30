import type { PushSubscriptionStatus, NotificationCategory, PushDeliveryStatus } from "@prisma/client";

export type { PushSubscriptionStatus, NotificationCategory, PushDeliveryStatus };

/** Domain entity — one browser/device push registration. `endpoint`/`p256dh`/`auth` are the Web Push protocol's three pieces, never logged once stored. */
export interface PushSubscription {
  id: string;
  userId: string;
  deviceId: string;
  browser: string | null;
  os: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  status: PushSubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Domain entity — per-user, per-category opt-out. Absence of a row means "enabled". */
export interface NotificationPreference {
  id: string;
  userId: string;
  category: NotificationCategory;
  enabled: boolean;
  updatedAt: Date;
}

/** Domain entity — one push attempt per device. DELIVERED/CLICKED are filled in later by Service Worker beacons. */
export interface PushNotificationLog {
  id: string;
  subscriptionId: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  deepLink: string | null;
  status: PushDeliveryStatus;
  errorMessage: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  clickedAt: Date | null;
  createdAt: Date;
}
