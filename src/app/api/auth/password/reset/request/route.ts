import { createRouteHandler } from "@/server/http";
import { withRateLimit, RateLimiters, ipFromRequest } from "@/server/cache";
import { handleRequestPasswordReset } from "@/modules/identity/controllers/password.controller";

export const POST = createRouteHandler(
  withRateLimit(RateLimiters.login, ipFromRequest)(handleRequestPasswordReset)
);
