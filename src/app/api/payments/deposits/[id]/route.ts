import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleGetDeposit } from "@/modules/payments/controllers/payments.controller";

type Ctx = { params: Promise<{ id: string }> };

export const GET = createRouteHandler<Ctx>(
  withAuth<Ctx>(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleGetDeposit(req, auth, id);
  })
);
