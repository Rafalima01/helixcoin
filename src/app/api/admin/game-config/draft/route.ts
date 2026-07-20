import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleUpsertDraft } from "@/modules/game-config/controllers/game-economy-config.controller";

export const POST = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleUpsertDraft(req, auth)));
