import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleBeginMatch } from "@/modules/match-engine/controllers/match-engine.controller";

type Ctx = { params: Promise<{ id: string }> };

export const POST = createRouteHandler<Ctx>(
  withAuth<Ctx>(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleBeginMatch(req, auth, id);
  })
);
