import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleUpdateMyPixKey, handleDeleteMyPixKey } from "@/modules/commercial-withdrawals/controllers/commercial-withdraw.controller";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = createRouteHandler<Ctx>(
  withAuth<Ctx>(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleUpdateMyPixKey(req, auth, id);
  })
);

export const DELETE = createRouteHandler<Ctx>(
  withAuth<Ctx>(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleDeleteMyPixKey(req, auth, id);
  })
);
