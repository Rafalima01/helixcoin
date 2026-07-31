import { z } from "zod";
import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError, ValidationError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { DashboardSummaryService } from "@/server/reports/dashboard-summary.service";
import { resolveDateRange } from "@/lib/date-range";

const { permissionService } = identityContainer;
const dashboardSummaryService = new DashboardSummaryService();

async function assertPermission(auth: AuthContext): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, "wallet.read"))) {
    throw new ForbiddenError();
  }
}

const querySchema = z
  .object({
    preset: z.enum(["today", "yesterday", "7d", "15d", "month", "custom"]).default("7d"),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .refine((v) => v.preset !== "custom" || (v.dateFrom && v.dateTo), {
    message: "dateFrom/dateTo são obrigatórios para preset=custom",
  });

export async function handleGetDashboardSummary(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth);
  const query = querySchema.parse({
    preset: req.nextUrl.searchParams.get("preset") ?? undefined,
    dateFrom: req.nextUrl.searchParams.get("dateFrom") ?? undefined,
    dateTo: req.nextUrl.searchParams.get("dateTo") ?? undefined,
  });

  let range;
  try {
    range = resolveDateRange(
      query.preset,
      query.dateFrom && query.dateTo ? { dateFrom: query.dateFrom, dateTo: query.dateTo } : undefined
    );
  } catch (err) {
    throw new ValidationError(err instanceof Error ? err.message : "Período inválido");
  }

  const summary = await dashboardSummaryService.build(range);
  return ok(summary);
}
