import type { PushSubscription, NotificationPreference, PushNotificationLog } from "@/modules/notifications/entities/notifications.entity";

export interface PushSubscriptionDto {
  id: string;
  deviceId: string;
  browser: string | null;
  os: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function toPushSubscriptionDto(entity: PushSubscription): PushSubscriptionDto {
  return {
    id: entity.id,
    deviceId: entity.deviceId,
    browser: entity.browser,
    os: entity.os,
    status: entity.status,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

export interface NotificationPreferenceDto {
  category: string;
  enabled: boolean;
}

export function toNotificationPreferenceDto(entity: NotificationPreference): NotificationPreferenceDto {
  return { category: entity.category, enabled: entity.enabled };
}

/** Never includes endpoint/p256dh/auth — those never leave the server once stored. */
export interface PushNotificationLogDto {
  id: string;
  subscriptionId: string;
  userId: string;
  category: string;
  title: string;
  body: string;
  deepLink: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  clickedAt: string | null;
  createdAt: string;
}

export function toPushNotificationLogDto(entity: PushNotificationLog): PushNotificationLogDto {
  return {
    id: entity.id,
    subscriptionId: entity.subscriptionId,
    userId: entity.userId,
    category: entity.category,
    title: entity.title,
    body: entity.body,
    deepLink: entity.deepLink,
    status: entity.status,
    errorMessage: entity.errorMessage,
    sentAt: entity.sentAt ? entity.sentAt.toISOString() : null,
    deliveredAt: entity.deliveredAt ? entity.deliveredAt.toISOString() : null,
    clickedAt: entity.clickedAt ? entity.clickedAt.toISOString() : null,
    createdAt: entity.createdAt.toISOString(),
  };
}
