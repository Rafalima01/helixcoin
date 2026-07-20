import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleRequestEmailVerification } from "@/modules/identity/controllers/email-verification.controller";

export const POST = createRouteHandler(
  withAuth((req, _ctx, auth) => handleRequestEmailVerification(req, auth))
);
