import type { NextRequest } from "next/server";
import { ok, created } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { env } from "@/server/config/env";
import { notificationsContainer } from "@/modules/notifications/container";
import { subscribeSchema } from "@/modules/notifications/validators/notifications.validator";
import { toPushSubscriptionDto } from "@/modules/notifications/dto/notifications.dto";

const { pushSubscriptionService } = notificationsContainer;

export async function handleGetVapidPublicKey() {
  return ok({ publicKey: env.VAPID_PUBLIC_KEY });
}

export async function handleSubscribe(req: NextRequest, auth: AuthContext) {
  const body = subscribeSchema.parse(await req.json());
  const subscription = await pushSubscriptionService.subscribe(auth.userId, body);
  return created(toPushSubscriptionDto(subscription));
}

export async function handleUnsubscribe(_req: NextRequest, auth: AuthContext, id: string) {
  await pushSubscriptionService.unsubscribe(auth.userId, id);
  return ok({ revoked: true });
}

export async function handleListMyDevices(_req: NextRequest, auth: AuthContext) {
  const devices = await pushSubscriptionService.listMyDevices(auth.userId);
  return ok(devices.map(toPushSubscriptionDto));
}
