import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { withRateLimit, RateLimiters, ipFromRequest } from "@/server/cache/rate-limit";
import { handleReportProgress } from "@/modules/match-engine/controllers/match-engine.controller";

type Ctx = { params: Promise<{ id: string }> };

export const POST = createRouteHandler<Ctx>(
  withRateLimit<Ctx>(
    RateLimiters.matchProgress,
    ipFromRequest
  )(
    withAuth<Ctx>(async (req, ctx, auth) => {
      const { id } = await ctx.params;
      return handleReportProgress(req, auth, id);
    })
  )
);
