import { createRouteHandler } from "@/server/http";
import { withRole, ROLE_HIERARCHY } from "@/server/auth";
import { handleGetDashboardSummary } from "@/server/reports/dashboard-summary.controller";

export const GET = createRouteHandler(withRole(...ROLE_HIERARCHY)((req, _ctx, auth) => handleGetDashboardSummary(req, auth)));
