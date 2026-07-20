import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import {
  handleGetUser,
  handleUpdateUser,
  handleSoftDeleteUser,
} from "@/modules/identity/controllers/user-management.controller";

type Ctx = { params: Promise<{ id: string }> };

export const GET = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleGetUser(req, auth, id);
  })
);

export const PATCH = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleUpdateUser(req, auth, id);
  })
);

export const DELETE = createRouteHandler<Ctx>(
  withRole<Ctx>(...ROLE_HIERARCHY)(async (req, ctx, auth) => {
    const { id } = await ctx.params;
    return handleSoftDeleteUser(req, auth, id);
  })
);
