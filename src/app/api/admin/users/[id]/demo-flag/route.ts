import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleSetUserDemoFlag } from "@/modules/demo-accounts/controllers/demo-accounts-admin.controller";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Lives under /admin/users/{id} (not /admin/demo-accounts/{id}) because it
 * targets a regular player account: the demo-accounts routes all assume the
 * subject is already a demo account and 404 otherwise.
 */
export const POST = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleSetUserDemoFlag(req, auth, id);
  })
);
