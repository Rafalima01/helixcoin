import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleSearchAudit } from "@/modules/identity/controllers/audit.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleSearchAudit(req, auth)));
