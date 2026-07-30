import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleGetPreferences, handleUpdatePreference } from "@/modules/notifications/controllers/notification-preference.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleGetPreferences(req, auth)));
export const PATCH = createRouteHandler(withAuth((req, _ctx, auth) => handleUpdatePreference(req, auth)));
