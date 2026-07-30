import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import {
  handleListDemoAccounts,
  handleCreateDemoAccount,
} from "@/modules/demo-accounts/controllers/demo-accounts-admin.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleListDemoAccounts(req, auth)));
export const POST = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleCreateDemoAccount(req, auth)));
