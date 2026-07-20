import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleListGameConfigVersions } from "@/modules/game-config/controllers/game-economy-config.controller";

export const GET = createRouteHandler(
  withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListGameConfigVersions(req, auth))
);
