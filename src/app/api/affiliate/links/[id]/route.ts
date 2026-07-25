import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleUpdateMyLink, handleDeleteMyLink } from "@/modules/affiliate/controllers/affiliate.controller";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = createRouteHandler<Ctx>(
  withAuth<Ctx>(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleUpdateMyLink(req, auth, id);
  })
);

export const DELETE = createRouteHandler<Ctx>(
  withAuth<Ctx>(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleDeleteMyLink(req, auth, id);
  })
);
