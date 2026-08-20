import type { NextRequest } from "next/server";
import { ok, created, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { BusinessRuleError, ForbiddenError } from "@/server/errors";
import { extractRequestMeta } from "@/server/audit";
import { decrypt } from "@/server/security/crypto-utils";
// Direct read, same precedent as affiliate.controller.ts's manager-invite-code
// resolution and affiliate-metrics.ts's prisma.user.count — resolving the
// commercial hierarchy (AffiliateProfile.managerId -> ManagerProfile,
// ManagerProfile's affiliate count) has no natural home in either module's
// own repository interfaces, and this module deliberately has no dependency
// on affiliate/manager's repositories.
import { prisma } from "@/lib/prisma";
import { identityContainer } from "@/modules/identity/container";
import { affiliateContainer } from "@/modules/affiliate/container";
import { managerContainer } from "@/modules/manager/container";
import { commercialWithdrawalsContainer } from "@/modules/commercial-withdrawals/container";
import {
  createPixKeySchema,
  updatePixKeySchema,
  requestCommercialWithdrawSchema,
  adminCommercialWithdrawDecisionSchema,
  adminCommercialWithdrawListQuerySchema,
  adminCommercialWithdrawSummaryQuerySchema,
} from "@/modules/commercial-withdrawals/validators/commercial-withdraw.validator";
import {
  toPixKeyDto,
  toCommercialWithdrawDto,
  toCommercialWithdrawAdminDto,
  type CommercialWithdrawHierarchyDto,
} from "@/modules/commercial-withdrawals/dto/commercial-withdraw.dto";
import type {
  CommercialWithdrawPayeeRole,
  CommercialWithdrawStatus,
  CommercialWithdrawAdminRow,
} from "@/modules/commercial-withdrawals/entities/commercial-withdraw.entity";

const { pixKeyService, commercialWithdrawService } = commercialWithdrawalsContainer;
const { permissionService } = identityContainer;

type CommercialPermission = "commercial.withdrawals.read" | "commercial.withdrawals.approve";

async function assertPermission(auth: AuthContext, key: CommercialPermission): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, key))) {
    throw new ForbiddenError();
  }
}

function roundToCents(amountReais: number): number {
  return Math.round(amountReais * 100);
}

// ---------------------------------------------------------------------------
// Commercial hierarchy — real AffiliateProfile.managerId / ManagerProfile
// relations, never invented. Shared by the list, single-item, and summary
// admin handlers below.
// ---------------------------------------------------------------------------

/**
 * "Vínculo" admin filter (Direto/De gerente) — CommercialWithdraw itself has
 * no managerId column, so DIRECT/MANAGED are resolved into a concrete
 * userId set via AffiliateProfile.managerId BEFORE the list/summary query
 * runs, then passed through as `userIdIn`. A MANAGER row is never a match
 * for either bond value (a manager has no "vínculo" of its own) — passing a
 * bond filter alongside payeeRole=MANAGER (or no payeeRole filter) correctly
 * yields zero MANAGER rows, which matches the literal meaning of the filter.
 */
async function resolveBondUserIds(bond: "DIRECT" | "MANAGED" | undefined): Promise<string[] | undefined> {
  if (!bond) return undefined;
  const rows = await prisma.affiliateProfile.findMany({
    where: bond === "DIRECT" ? { managerId: null } : { managerId: { not: null } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

const EMPTY_HIERARCHY: CommercialWithdrawHierarchyDto = {
  isDirectAffiliate: null,
  managerId: null,
  managerName: null,
  managerEmail: null,
  affiliateCount: null,
};

/**
 * Batched — exactly 2 queries (one for every AFFILIATE row's manager join,
 * one for every MANAGER row's affiliate count), regardless of how many rows
 * are in `rows`. Never one query per row (see the module's N+1 constraint).
 */
async function resolveHierarchy(rows: CommercialWithdrawAdminRow[]): Promise<Map<string, CommercialWithdrawHierarchyDto>> {
  const affiliateUserIds = [...new Set(rows.filter((r) => r.payeeRole === "AFFILIATE").map((r) => r.userId))];
  const managerUserIds = [...new Set(rows.filter((r) => r.payeeRole === "MANAGER").map((r) => r.userId))];

  const [affiliateProfiles, managerProfiles] = await Promise.all([
    affiliateUserIds.length
      ? prisma.affiliateProfile.findMany({
          where: { userId: { in: affiliateUserIds } },
          select: {
            userId: true,
            managerId: true,
            manager: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
          },
        })
      : Promise.resolve([]),
    managerUserIds.length
      ? prisma.managerProfile.findMany({
          where: { userId: { in: managerUserIds } },
          select: { userId: true, _count: { select: { affiliates: true } } },
        })
      : Promise.resolve([]),
  ]);

  const byUserId = new Map<string, CommercialWithdrawHierarchyDto>();
  for (const p of affiliateProfiles) {
    byUserId.set(p.userId, {
      isDirectAffiliate: p.managerId === null,
      managerId: p.managerId,
      managerName: p.manager ? `${p.manager.user.firstName} ${p.manager.user.lastName}`.trim() : null,
      managerEmail: p.manager?.user.email ?? null,
      affiliateCount: null,
    });
  }
  for (const m of managerProfiles) {
    byUserId.set(m.userId, { ...EMPTY_HIERARCHY, affiliateCount: m._count.affiliates });
  }
  return byUserId;
}

// ---------------------------------------------------------------------------
// PIX keys — role-agnostic, used by both the Affiliate and Manager routes.
// ---------------------------------------------------------------------------

export async function handleListMyPixKeys(_req: NextRequest, auth: AuthContext) {
  const keys = await pixKeyService.list(auth.userId);
  return ok(keys.map((k) => toPixKeyDto(k, decrypt(k.keyEncrypted))));
}

export async function handleCreateMyPixKey(req: NextRequest, auth: AuthContext) {
  const body = createPixKeySchema.parse(await req.json());
  const key = await pixKeyService.create(auth.userId, { type: body.type, key: body.key, holderCpf: body.holderCpf });
  return created(toPixKeyDto(key, decrypt(key.keyEncrypted)));
}

export async function handleUpdateMyPixKey(req: NextRequest, auth: AuthContext, id: string) {
  const body = updatePixKeySchema.parse(await req.json());
  const key = await pixKeyService.update(auth.userId, id, body);
  return ok(toPixKeyDto(key, decrypt(key.keyEncrypted)));
}

export async function handleDeleteMyPixKey(_req: NextRequest, auth: AuthContext, id: string) {
  await pixKeyService.delete(auth.userId, id);
  return ok({ deleted: true });
}

// ---------------------------------------------------------------------------
// Withdrawals — player-facing (Affiliate/Manager)
// ---------------------------------------------------------------------------

export async function handleRequestAffiliateWithdraw(req: NextRequest, auth: AuthContext) {
  const profile = await affiliateContainer.affiliateService.getProfile(auth.userId);
  if (profile.status !== "APPROVED") {
    throw new BusinessRuleError("Sua conta de afiliado ainda não foi aprovada");
  }
  return requestWithdraw(req, auth, "AFFILIATE");
}

export async function handleRequestManagerWithdraw(req: NextRequest, auth: AuthContext) {
  // getByUserId throws NotFoundError if the caller has no ManagerProfile at all — same gate every other manager.controller.ts handler relies on.
  await managerContainer.managerService.getByUserId(auth.userId);
  return requestWithdraw(req, auth, "MANAGER");
}

async function requestWithdraw(req: NextRequest, auth: AuthContext, payeeRole: CommercialWithdrawPayeeRole) {
  const body = requestCommercialWithdrawSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  const withdraw = await commercialWithdrawService.request({
    userId: auth.userId,
    payeeRole,
    amountCents: roundToCents(body.amount),
    pixKeyId: body.pixKeyId,
    actor: { actorId: auth.userId, actorType: "USER", ip: meta.ip, userAgent: meta.userAgent },
  });
  return created(toCommercialWithdrawDto(withdraw, decrypt(withdraw.pixKeyEncrypted)));
}

/** Role-agnostic — just `auth.userId`, used by both /api/affiliate/withdrawals and /api/manager/withdrawals GETs. */
export async function handleListMyCommercialWithdraws(req: NextRequest, auth: AuthContext) {
  const pagination = parsePagination(req.nextUrl.searchParams);
  const { items, total } = await commercialWithdrawService.listMine(auth.userId, pagination.page, pagination.pageSize);
  return ok(
    items.map((w) => toCommercialWithdrawDto(w, decrypt(w.pixKeyEncrypted))),
    buildPaginationMeta(pagination, total)
  );
}

// ---------------------------------------------------------------------------
// Admin — "Saques Comerciais"
// ---------------------------------------------------------------------------

export async function handleListCommercialWithdrawalsAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "commercial.withdrawals.read");
  const url = req.nextUrl;
  const pagination = parsePagination(url.searchParams);
  const query = adminCommercialWithdrawListQuerySchema.parse({
    status: url.searchParams.get("status") ?? undefined,
    payeeRole: url.searchParams.get("payeeRole") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    bond: url.searchParams.get("bond") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const userIdIn = await resolveBondUserIds(query.bond);
  const { items, total } = await commercialWithdrawService.listAdmin({
    status: query.status as CommercialWithdrawStatus | undefined,
    payeeRole: query.payeeRole as CommercialWithdrawPayeeRole | undefined,
    userId: query.userId,
    userIdIn,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  const hierarchyByUserId = await resolveHierarchy(items.map(({ row }) => row));

  return ok(
    items.map(({ row, pixKeyMasked }) =>
      toCommercialWithdrawAdminDto(row, pixKeyMasked, hierarchyByUserId.get(row.userId) ?? EMPTY_HIERARCHY)
    ),
    buildPaginationMeta(pagination, total)
  );
}

export async function handleGetCommercialWithdrawAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "commercial.withdrawals.read");
  const { withdraw, pixKeyMasked } = await commercialWithdrawService.getAdmin(id);
  const hierarchyByUserId = await resolveHierarchy([withdraw]);
  return ok(toCommercialWithdrawAdminDto(withdraw, pixKeyMasked, hierarchyByUserId.get(withdraw.userId) ?? EMPTY_HIERARCHY));
}

/** GET /api/admin/commercial-withdrawals/summary — the admin page's summary cards, same filters as the list minus status/pagination. */
export async function handleGetCommercialWithdrawalsSummaryAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "commercial.withdrawals.read");
  const url = req.nextUrl;
  const query = adminCommercialWithdrawSummaryQuerySchema.parse({
    payeeRole: url.searchParams.get("payeeRole") ?? undefined,
    bond: url.searchParams.get("bond") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const userIdIn = await resolveBondUserIds(query.bond);
  const summary = await commercialWithdrawalsContainer.commercialWithdrawRepository.getSummary({
    payeeRole: query.payeeRole as CommercialWithdrawPayeeRole | undefined,
    userIdIn,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  });

  return ok(summary);
}

export async function handleDecideCommercialWithdrawAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "commercial.withdrawals.approve");
  const body = adminCommercialWithdrawDecisionSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  const decided = await commercialWithdrawService.decide({
    id,
    action: body.action,
    rejectionReason: body.rejectionReason,
    actor: { id: auth.userId, role: auth.role! },
    meta,
  });
  return ok({ id: decided.id, status: decided.status });
}
