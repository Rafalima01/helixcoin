import type { NextRequest } from "next/server";
import { ok, created, parsePagination, buildPaginationMeta } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { BusinessRuleError, ForbiddenError } from "@/server/errors";
import { extractRequestMeta } from "@/server/audit";
import { decrypt } from "@/server/security/crypto-utils";
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
} from "@/modules/commercial-withdrawals/validators/commercial-withdraw.validator";
import {
  toPixKeyDto,
  toCommercialWithdrawDto,
  toCommercialWithdrawAdminDto,
} from "@/modules/commercial-withdrawals/dto/commercial-withdraw.dto";
import type { CommercialWithdrawPayeeRole, CommercialWithdrawStatus } from "@/modules/commercial-withdrawals/entities/commercial-withdraw.entity";

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
  });

  const { items, total } = await commercialWithdrawService.listAdmin({
    status: query.status as CommercialWithdrawStatus | undefined,
    payeeRole: query.payeeRole as CommercialWithdrawPayeeRole | undefined,
    userId: query.userId,
    page: pagination.page,
    pageSize: pagination.pageSize,
  });

  return ok(
    items.map(({ row, pixKeyMasked }) => toCommercialWithdrawAdminDto(row, pixKeyMasked)),
    buildPaginationMeta(pagination, total)
  );
}

export async function handleGetCommercialWithdrawAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "commercial.withdrawals.read");
  const { withdraw, pixKeyMasked } = await commercialWithdrawService.getAdmin(id);
  return ok(toCommercialWithdrawAdminDto(withdraw, pixKeyMasked));
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
