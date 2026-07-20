import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleGetMfaStatus } from "@/modules/identity/controllers/mfa.controller";

export const GET = createRouteHandler(withAuth((req, _ctx, auth) => handleGetMfaStatus(req, auth)));
