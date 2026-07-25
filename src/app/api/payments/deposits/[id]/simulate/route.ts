import { createRouteHandler } from "@/server/http";
import { withAuth } from "@/server/auth";
import { handleSimulateDeposit } from "@/modules/payments/controllers/payments.controller";

type Ctx = { params: Promise<{ id: string }> };

export const POST = createRouteHandler<Ctx>(
  withAuth<Ctx>(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleSimulateDeposit(req, auth, id);
  })
);
