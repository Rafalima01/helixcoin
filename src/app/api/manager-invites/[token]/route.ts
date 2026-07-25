import { createRouteHandler } from "@/server/http";
import { withRateLimit, RateLimiters, ipFromRequest } from "@/server/cache";
import { handleGetManagerInvitePublic } from "@/modules/manager/controllers/manager-invite.controller";

type Ctx = { params: Promise<{ token: string }> };

export const GET = createRouteHandler<Ctx>(
  withRateLimit<Ctx>(RateLimiters.login, ipFromRequest)(async (req, ctx) => {
    const { token } = await ctx.params;
    return handleGetManagerInvitePublic(req, token);
  })
);
