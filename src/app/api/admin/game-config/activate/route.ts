import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleActivateDraft } from "@/modules/game-config/controllers/game-economy-config.controller";

export const POST = createRouteHandler(
  withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleActivateDraft(req, auth))
);
