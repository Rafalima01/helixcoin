import type { NextRequest } from "next/server";
import { ok } from "@/server/http";
import type { AuthContext } from "@/server/auth/context";
import { ForbiddenError } from "@/server/errors";
import { extractRequestMeta } from "@/server/audit";
import { identityContainer } from "@/modules/identity/container";
import { managerContainer } from "@/modules/manager/container";
import { toManagerProfileDto, toManagerProfileAdminDto, toAffiliateNetworkStatsDto } from "@/modules/manager/dto/manager.dto";
import { toAffiliateProfileAdminDto } from "@/modules/affiliate/dto/affiliate.dto";
import { decideAffiliateApplicationSchema } from "@/modules/affiliate/validators/affiliate.validator";
import {
  updateManagerCommissionSchema,
  updateNetworkAffiliateCommissionSchema,
  updateNetworkAffiliateInvitePermissionSchema,
} from "@/modules/manager/validators/manager.validator";

const { managerService } = managerContainer;
const { permissionService } = identityContainer;

async function assertPermission(auth: AuthContext, key: "manager.read" | "manager.manage"): Promise<void> {
  if (!auth.role || !(await permissionService.hasPermission(auth.role, key))) {
    throw new ForbiddenError();
  }
}

/**
 * The entire Manager portal's API. Every handler resolves the caller's own
 * ManagerProfile from `auth.userId` first, then scopes every downstream
 * call to it — a Manager can never see another manager's network. No
 * Wallet/Ledger/Payments import anywhere in this file, by design.
 */
export async function handleGetMyManagerProfile(_req: NextRequest, auth: AuthContext) {
  const profile = await managerService.getByUserId(auth.userId);
  return ok(toManagerProfileDto(profile));
}

export async function handleGetManagerDashboard(_req: NextRequest, auth: AuthContext) {
  const profile = await managerService.getByUserId(auth.userId);
  const stats = await managerService.getDashboard(profile.id);
  return ok(stats);
}

export async function handleListApprovals(_req: NextRequest, auth: AuthContext) {
  const profile = await managerService.getByUserId(auth.userId);
  const { items, total } = await managerService.listApprovals(profile.id);
  return ok(items.map(toAffiliateProfileAdminDto), { total });
}

export async function handleDecideApproval(req: NextRequest, auth: AuthContext, affiliateId: string) {
  const profile = await managerService.getByUserId(auth.userId);
  const body = decideAffiliateApplicationSchema.parse(await req.json());
  await managerService.decideApplication(profile.id, affiliateId, body.action, body.reason, auth.userId);
  const updated = await managerService.getNetworkAffiliate(profile.id, affiliateId);
  return ok(toAffiliateProfileAdminDto(updated));
}

export async function handleListMyNetwork(_req: NextRequest, auth: AuthContext) {
  const profile = await managerService.getByUserId(auth.userId);
  const { items, total } = await managerService.getNetworkWithStats(profile.id);
  return ok(items.map(toAffiliateNetworkStatsDto), { total });
}

export async function handleGetMyNetworkAffiliate(_req: NextRequest, auth: AuthContext, affiliateId: string) {
  const profile = await managerService.getByUserId(auth.userId);
  const affiliate = await managerService.getNetworkAffiliate(profile.id, affiliateId);
  return ok(toAffiliateProfileAdminDto(affiliate));
}

/** "Links e Convites" — the two-link model (see AGENTS.md's "Refinamento Fase 8"). */
export async function handleGetManagerLinks(_req: NextRequest, auth: AuthContext) {
  const profile = await managerService.getByUserId(auth.userId);
  const links = await managerService.getLinks(profile.id);
  return ok(links);
}

/** A Manager sets one of their own network affiliates' commission — server-enforced ceiling, never trusts the frontend-supplied percent beyond validation range. */
export async function handleUpdateNetworkAffiliateCommission(req: NextRequest, auth: AuthContext, affiliateId: string) {
  const profile = await managerService.getByUserId(auth.userId);
  const body = updateNetworkAffiliateCommissionSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  const updated = await managerService.updateNetworkAffiliateCommission(profile.id, affiliateId, body.percent, {
    actorId: auth.userId,
    actorRole: auth.role!,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return ok(toAffiliateProfileAdminDto(await managerService.getNetworkAffiliate(profile.id, updated.id)));
}

/** A Manager grants/revokes a network affiliate's "Convidar Afiliados" permission (see AGENTS.md's "Painel do Afiliado Integrado"). */
export async function handleUpdateNetworkAffiliateInvitePermission(req: NextRequest, auth: AuthContext, affiliateId: string) {
  const profile = await managerService.getByUserId(auth.userId);
  const body = updateNetworkAffiliateInvitePermissionSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  const updated = await managerService.updateNetworkAffiliateInvitePermission(profile.id, affiliateId, body.canInviteAffiliates, {
    actorId: auth.userId,
    actorRole: auth.role!,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return ok(toAffiliateProfileAdminDto(await managerService.getNetworkAffiliate(profile.id, updated.id)));
}

// ------------------------------------------------------------------ admin

export async function handleListManagersAdmin(req: NextRequest, auth: AuthContext) {
  await assertPermission(auth, "manager.read");
  const url = req.nextUrl;
  const search = url.searchParams.get("search") ?? undefined;
  const { items, total } = await managerService.listAdmin({ search, page: 1, pageSize: 100 });
  return ok(items.map(toManagerProfileAdminDto), { total });
}

export async function handleGetManagerAdmin(_req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "manager.read");
  const profile = await managerService.getByIdAdmin(id);
  return ok(toManagerProfileAdminDto(profile));
}

export async function handleActivateManagerAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "manager.manage");
  const meta = extractRequestMeta(req);
  const profile = await managerService.activateProfile(id, { id: auth.userId, role: auth.role! }, meta);
  return ok(toManagerProfileDto(profile));
}

export async function handleUpdateManagerCommissionAdmin(req: NextRequest, auth: AuthContext, id: string) {
  await assertPermission(auth, "manager.manage");
  const body = updateManagerCommissionSchema.parse(await req.json());
  const meta = extractRequestMeta(req);
  const profile = await managerService.updateCommission(id, body.commissionPercent, { id: auth.userId, role: auth.role! }, meta);
  return ok(toManagerProfileDto(profile));
}
