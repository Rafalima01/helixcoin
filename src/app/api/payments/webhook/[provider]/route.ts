import { createRouteHandler } from "@/server/http";
import { withRateLimit, RateLimiters, ipFromRequest } from "@/server/cache/rate-limit";
import { handleWebhook } from "@/modules/payments/controllers/payments.controller";

type Ctx = { params: Promise<{ provider: string }> };

/** No withAuth — external gateway callers. Signature verification (see PaymentService.handleWebhook) is the real authentication here, not a session. */
export const POST = createRouteHandler<Ctx>(
  withRateLimit<Ctx>(
    RateLimiters.webhooks,
    ipFromRequest
  )(async (req, ctx) => {
    const { provider } = await ctx.params;
    return handleWebhook(req, provider);
  })
);
