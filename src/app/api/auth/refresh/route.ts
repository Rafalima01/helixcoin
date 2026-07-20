import { createRouteHandler } from "@/server/http";
import { handleRefresh } from "@/modules/identity/controllers/auth.controller";

export const POST = createRouteHandler(handleRefresh);
