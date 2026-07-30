import { createRouteHandler } from "@/server/http";
import { handleGetVapidPublicKey } from "@/modules/notifications/controllers/push-subscription.controller";

/** Public on purpose — the VAPID public key is meant to be handed to the browser's PushManager.subscribe(), never a secret. */
export const GET = createRouteHandler(async () => handleGetVapidPublicKey());
