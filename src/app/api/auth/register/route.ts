import { createRouteHandler } from "@/server/http";
import { withRateLimit, RateLimiters, ipFromRequest } from "@/server/cache";
import { handleRegister } from "@/modules/identity/controllers/auth.controller";

export const POST = createRouteHandler(withRateLimit(RateLimiters.api, ipFromRequest)(handleRegister));
