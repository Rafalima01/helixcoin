import { z } from "zod";
import { NOTIFICATION_CATEGORIES } from "@/modules/notifications/constants/notifications.constants";

const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES);

/** POST /api/push/subscribe — shape matches the browser's PushSubscription.toJSON() output (endpoint + keys.{p256dh,auth}), plus client-supplied device metadata. */
export const subscribeSchema = z.object({
  deviceId: z.string().min(1),
  browser: z.string().max(120).optional(),
  os: z.string().max(120).optional(),
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

/** PATCH /api/notifications/preferences */
export const updatePreferenceSchema = z.object({
  category: notificationCategorySchema,
  enabled: z.boolean(),
});
export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;

/** POST /api/push/delivered, POST /api/push/clicked — logId is echoed back from the push payload the Service Worker received. */
export const beaconSchema = z.object({
  logId: z.string().min(1),
});
export type BeaconInput = z.infer<typeof beaconSchema>;

export const adminHistoryListQuerySchema = z.object({
  userId: z.string().optional(),
  category: notificationCategorySchema.optional(),
  status: z.enum(["QUEUED", "SENT", "DELIVERED", "FAILED", "CLICKED"]).optional(),
});
export type AdminHistoryListQuery = z.infer<typeof adminHistoryListQuerySchema>;
