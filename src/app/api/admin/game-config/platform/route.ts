import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import {
  handleGetPlatformConfig,
  handleUpdateMaintenanceMode,
} from "@/modules/game-config/controllers/game-economy-config.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleGetPlatformConfig(req, auth)));
export const PATCH = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleUpdateMaintenanceMode(req, auth)));
