import { createRouteHandler } from "@/server/http";
import { withRateLimit, RateLimiters, ipFromRequest } from "@/server/cache";
import { handleConfirmPasswordReset } from "@/modules/identity/controllers/password.controller";

export const POST = createRouteHandler(
  withRateLimit(RateLimiters.login, ipFromRequest)(handleConfirmPasswordReset)
);
