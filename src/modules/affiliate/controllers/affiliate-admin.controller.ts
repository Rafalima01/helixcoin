import type { NextRequest } from "next/server";
import { ok, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError } from "@/server/errors";
import { identityContainer } from "@/modules/identity/container";
import { affiliateContainer } from "@/modules/affiliate/container";
import {
  adminAffiliateListQuerySchema,
  adminCommissionListQuerySchema,
  decideAffiliateApplicationSchema,
  decideCommissionSchema,
  affiliateSettingsUpdateSchema,
} from "@/modules/affiliate/validators/affiliate.validator";
import {
  toAffiliateProfileAdminDto,
  toCommissionAdminDto,
  toAffiliateSettingsDto,
} from "@/modules/affiliate/dto/affiliate.dto";
import type { AffiliateStatus, CommissionStatus } from "@/modules/affiliate/entities/affiliate.entity";

const { affiliateService, commissionService, commissionRepository } = affiliateContainer;
const { permissionService } = identityContainer;

type AffiliatePermission =
  | "affiliate.applications.read"
  | "affiliate.applications.approve"
  | "affiliate.commissions.read"
  | "affiliate.commissions.approve"
  | "affiliate.settings.manage";

async function assertPermission(auth: AuthContext, key: AffiliatePermission): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, key))) {
    throw new ForbiddenError();
  }
}

function dateOrUndefined(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

// ---------------------------------------------------------------- applications

export async function handleListApplicationsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "affiliate.applications.read");
  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminAffiliateListQuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
    managerId: url.searchParams.get("managerId") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });

  const { items, total } = await affiliateService.listAdmin({
    status: query.status as AffiliateStatus | undefined,
    managerId: query.managerId,
    search: query.search,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toAffiliateProfileAdminDto), buildPaginationMeta(pagination, total));
}

export async function handleGetApplicationAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "affiliate.applications.read");
  const profile = await affiliateService.getByIdAdmin(id);
  return ok(toAffiliateProfileAdminDto(profile));
}

export async function handleDecideApplicationAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "affiliate.applications.approve");
  const body = decideAffiliateApplicationSchema.parse(await req.json());
  const updated = await affiliateService.decide(id, body.action, body.reason, {
    actorId: auth.userId,
    actorRole: auth.role!,
  });
  return ok(toAffiliateProfileAdminDto(await affiliateService.getByIdAdmin(updated.id)));
}

export async function handleAssignManagerAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "affiliate.applications.approve");
  const body = (await req.json()) as { managerId: string | null };
  const updated = await affiliateService.assignManager(id, body.managerId);
  return ok(toAffiliateProfileAdminDto(await affiliateService.getByIdAdmin(updated.id)));
}

// ----------------------------------------------------------------- commissions

export async function handleListCommissionsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "affiliate.commissions.read");
  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminCommissionListQuerySchema.parse({
    affiliateId: url.searchParams.get("affiliateId") ?? undefined,
    managerId: url.searchParams.get("managerId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const { items, total } = await commissionRepository.listAdmin({
    affiliateId: query.affiliateId,
    managerId: query.managerId,
    status: query.status as CommissionStatus | undefined,
    from: dateOrUndefined(query.from),
    to: dateOrUndefined(query.to),
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(items.map(toCommissionAdminDto), buildPaginationMeta(pagination, total));
}

export async function handleDecideCommissionAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "affiliate.commissions.approve");
  const body = decideCommissionSchema.parse(await req.json());
  const updated =
    body.action === "APPROVE" ? await commissionService.approve(id) : await commissionService.reject(id, body.reason!);
  return ok(updated);
}

// -------------------------------------------------------------------- settings

export async function handleGetAffiliateSettingsAdmin(_req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "affiliate.settings.manage");
  const settings = await affiliateService.getSettings();
  return ok(toAffiliateSettingsDto(settings));
}

export async function handleUpdateAffiliateSettingsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "affiliate.settings.manage");
  const body = affiliateSettingsUpdateSchema.parse(await req.json());
  const settings = await affiliateService.updateSettings(body);
  return ok(toAffiliateSettingsDto(settings));
}
