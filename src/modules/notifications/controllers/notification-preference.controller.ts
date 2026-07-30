import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { notificationsContainer } from "@/modules/notifications/container";
import { updatePreferenceSchema } from "@/modules/notifications/validators/notifications.validator";

const { notificationPreferenceService } = notificationsContainer;

/** Self-service — any authenticated role. Returns only the categories relevant to the caller's own role (empty list for a role with none, e.g. AFFILIATE this phase). */
export async function handleGetPreferences(_req: NextRequest, auth: AuthContext) {
  const preferences = await notificationPreferenceService.listForRole(auth.userId, auth.role ?? "USER");
  return ok(preferences);
}

export async function handleUpdatePreference(req: NextRequest, auth: AuthContext) {
  const body = updatePreferenceSchema.parse(await req.json());
  const preference = await notificationPreferenceService.update(auth.userId, auth.role ?? "USER", body.category, body.enabled);
  return ok(preference);
}
