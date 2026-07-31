import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { DashboardSummaryService } from "@/server/reports/dashboard-summary.service";

const { permissionService } = identityContainer;
const dashboardSummaryService = new DashboardSummaryService();

async function assertPermission(auth: AuthContext): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, "wallet.read"))) {
    throw new ForbiddenError();
  }
}

export async function handleGetDashboardSummary(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth);
  const days = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 7));
  const summary = await dashboardSummaryService.build(days);
  return ok(summary);
}
