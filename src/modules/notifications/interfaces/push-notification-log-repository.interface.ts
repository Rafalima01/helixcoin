import type { PushNotificationLog, PushDeliveryStatus, NotificationCategory } from "@/modules/notifications/entities/notifications.entity";

export interface CreatePushNotificationLogInput {
  subscriptionId: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  deepLink?: string | null;
}

export interface UpdatePushNotificationLogInput {
  status?: PushDeliveryStatus;
  errorMessage?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  clickedAt?: Date | null;
}

export interface PushNotificationLogListFilter {
  userId?: string;
  category?: NotificationCategory;
  status?: PushDeliveryStatus;
  page: number;
  pageSize: number;
}

/** Append-mostly — created QUEUED, updated as the job processor / beacons learn more. */
export interface IPushNotificationLogRepository {
  create(input: CreatePushNotificationLogInput): Promise<PushNotificationLog>;
  findById(id: string): Promise<PushNotificationLog | null>;
  update(id: string, input: UpdatePushNotificationLogInput): Promise<PushNotificationLog>;
  listAdmin(filter: PushNotificationLogListFilter): Promise<{ items: PushNotificationLog[]; total: number }>;
}
