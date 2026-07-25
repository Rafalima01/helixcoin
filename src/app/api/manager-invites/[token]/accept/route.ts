import { createRouteHandler } from "@/server/http";
import { withRateLimit, RateLimiters, ipFromRequest } from "@/server/cache";
import { handleAcceptManagerInvite } from "@/modules/manager/controllers/manager-invite.controller";

type Ctx = { params: Promise<{ token: string }> };

export const POST = createRouteHandler<Ctx>(
  withRateLimit<Ctx>(RateLimiters.login, ipFromRequest)(async (req, ctx) => {
    const { token } = await ctx.params;
    return handleAcceptManagerInvite(req, token);
  })
);
