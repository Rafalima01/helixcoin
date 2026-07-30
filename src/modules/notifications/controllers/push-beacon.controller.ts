import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { notificationsContainer } from "@/modules/notifications/container";
import { beaconSchema } from "@/modules/notifications/validators/notifications.validator";

const { notificationHistoryService } = notificationsContainer;

/** Called by the Service Worker's `push` handler right after showing the notification — "entregue" per the spec's history requirement. Silently no-ops on an unknown/foreign logId (never lets a beacon fail loudly on the client). */
export async function handleDeliveredBeacon(req: NextRequest, _auth: AuthContext) {
  const body = beaconSchema.parse(await req.json());
  await notificationHistoryService.markDelivered(body.logId);
  return ok({ acknowledged: true });
}

/** Called by the Service Worker's `notificationclick` handler — "clicado". */
export async function handleClickedBeacon(req: NextRequest, _auth: AuthContext) {
  const body = beaconSchema.parse(await req.json());
  await notificationHistoryService.markClicked(body.logId);
  return ok({ acknowledged: true });
}
