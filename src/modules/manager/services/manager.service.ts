import type { Role } from "@prisma/client";
import { NotFoundError, ForbiddenError, BusinessRuleError } from "@/server/errors";
import { AuditService } from "@/server/audit";
// Direct read, same precedent as affiliate.service.ts's apply() — a plain
// count/distinct query with no natural home in either module's repository
// interfaces, not worth a cross-module service dependency for.
import { prisma } from "@/lib/prisma";
import { identityContainer } from "@/modules/identity/container";
import type { AffiliateService, AffiliateDecisionAction, DecisionActor } from "@/modules/affiliate/services/affiliate.service";
import type { ICommissionRepository } from "@/modules/affiliate/interfaces/commission-repository.interface";
import type { IManagerRepository } from "@/modules/manager/interfaces/manager-repository.interface";
import type {
  ManagerProfile,
  ManagerProfileAdminRow,
  ManagerDashboardStats,
  ManagerLinksData,
  AffiliateNetworkStatsRow,
} from "@/modules/manager/entities/manager.entity";
import type { ManagerProfileListFilter } from "@/modules/manager/interfaces/manager-repository.interface";
import { zoneUrl } from "@/config/domains";

/**
 * Owns ManagerProfile — pure oversight, zero financial/platform data (see
 * AGENTS.md Phase 8 decision). `affiliateService`/`commissions` are injected
 * (real Prisma-backed instances wired in container.ts, in-memory-backed in
 * tests) — same "inject the concrete class, don't import the container
 * singleton inside a service" convention as CommissionService injecting
 * WalletService. Never touches Wallet/Ledger anywhere in this file.
 *
 * There is no `createManager()` here anymore — the ONLY way a User becomes
 * a Manager is by accepting an admin-issued onboarding invite (see
 * ManagerInviteService.accept, "Convite de Gerente"), which creates the
 * User AND the ManagerProfile together. This service only manages existing
 * ManagerProfile rows.
 */
export class ManagerService {
  constructor(
    private readonly managers: IManagerRepository,
    private readonly affiliateService: AffiliateService,
    private readonly commissions: ICommissionRepository
  ) {}

  async getByUserId(userId: string): Promise<ManagerProfile> {
    const profile = await this.managers.findByUserId(userId);
    if (!profile) throw new NotFoundError("Perfil de gerente");
    return profile;
  }

  async getByIdAdmin(id: string): Promise<ManagerProfileAdminRow> {
    const profile = await this.managers.findByIdAdmin(id);
    if (!profile) throw new NotFoundError("Gerente");
    return profile;
  }

  async listAdmin(filter: ManagerProfileListFilter) {
    return this.managers.listAdmin(filter);
  }

  /** Pendente → Ativo — unblocks /manager portal access (see the invite's "Status inicial" decision). */
  async activateProfile(id: string, actor: { id: string; role: Role }, meta: { ip: string | null; userAgent: string | null }): Promise<ManagerProfile> {
    const profile = await this.managers.findById(id);
    if (!profile) throw new NotFoundError("Gerente");
    if (profile.status === "ACTIVE") throw new BusinessRuleError("Gerente já está ativo");

    const updated = await this.managers.update(id, { status: "ACTIVE" });
    await AuditService.record({
      actorId: actor.id,
      actorType: "ADMIN",
      actorRole: actor.role,
      action: "manager.activate",
      entityType: "ManagerProfile",
      entityId: id,
      before: { status: profile.status },
      after: { status: "ACTIVE" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  async updateCommission(
    id: string,
    commissionPercent: number,
    actor: { id: string; role: Role },
    meta: { ip: string | null; userAgent: string | null }
  ): Promise<ManagerProfile> {
    const profile = await this.managers.findById(id);
    if (!profile) throw new NotFoundError("Gerente");

    const updated = await this.managers.update(id, { commissionPercent });
    await AuditService.record({
      actorId: actor.id,
      actorType: "ADMIN",
      actorRole: actor.role,
      action: "manager.commission.update",
      entityType: "ManagerProfile",
      entityId: id,
      before: { commissionPercent: profile.commissionPercent },
      after: { commissionPercent },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return updated;
  }

  /** Network-scoped affiliate applications — only PENDING ones under this manager. */
  async listApprovals(managerId: string) {
    return this.affiliateService.listAdmin({ managerId, status: "PENDING", page: 1, pageSize: 100 });
  }

  /** Delegates the actual state transition to AffiliateService — this method only adds the ownership scope check (see AffiliateService.decide's `scopeManagerId` param). */
  async decideApplication(
    managerId: string,
    affiliateId: string,
    action: AffiliateDecisionAction,
    reason: string | undefined,
    actorUserId: string
  ) {
    return this.affiliateService.decide(
      affiliateId,
      action,
      reason,
      { actorId: actorUserId, actorRole: "MANAGER" },
      managerId
    );
  }

  async listNetwork(managerId: string) {
    return this.affiliateService.listAdmin({ managerId, page: 1, pageSize: 100 });
  }

  /**
   * "Minha Rede" with the full financial rollup per affiliate (see
   * AffiliateNetworkStatsRow). Bounded query count regardless of network
   * size — listNetwork() (1 query) + one Commission groupBy (1 query) +
   * one User findMany + one Deposit findMany, both scoped to this
   * network's userIds via a single IN clause, never one query per
   * affiliate. Deposit/User totals are joined in application code because
   * Prisma's groupBy can't group by a related model's field
   * (User.referredById) directly.
   */
  async getNetworkWithStats(managerId: string): Promise<{ items: AffiliateNetworkStatsRow[]; total: number }> {
    const { items, total } = await this.listNetwork(managerId);
    if (items.length === 0) return { items: [], total: 0 };

    const affiliateUserIds = items.map((a) => a.userId);

    const [referredUsers, deposits, commissionAgg] = await Promise.all([
      prisma.user.findMany({
        where: { referredById: { in: affiliateUserIds } },
        select: { referredById: true, status: true },
      }),
      prisma.deposit.findMany({
        where: { status: "PAID", user: { referredById: { in: affiliateUserIds } } },
        select: { amountCents: true, user: { select: { referredById: true } } },
      }),
      this.commissions.getNetworkAggregates(managerId),
    ]);

    const activeCountByReferrer = new Map<string, number>();
    for (const u of referredUsers) {
      if (u.status !== "ACTIVE" || !u.referredById) continue;
      activeCountByReferrer.set(u.referredById, (activeCountByReferrer.get(u.referredById) ?? 0) + 1);
    }

    const depositTotalByReferrer = new Map<string, number>();
    for (const d of deposits) {
      const referrerId = d.user.referredById;
      if (!referrerId) continue;
      depositTotalByReferrer.set(referrerId, (depositTotalByReferrer.get(referrerId) ?? 0) + d.amountCents);
    }

    const statsRows: AffiliateNetworkStatsRow[] = items.map((affiliate) => {
      const agg = commissionAgg.get(affiliate.id) ?? { paidToAffiliateCents: 0, keptByManagerCents: 0, ftdCount: 0 };
      const depositTotalCents = depositTotalByReferrer.get(affiliate.userId) ?? 0;
      const commissionGeneratedCents = agg.paidToAffiliateCents + agg.keptByManagerCents;
      return {
        ...affiliate,
        depositTotalCents,
        activePlayers: activeCountByReferrer.get(affiliate.userId) ?? 0,
        ftdCount: agg.ftdCount,
        commissionGeneratedCents,
        paidToAffiliateCents: agg.paidToAffiliateCents,
        keptByManagerCents: agg.keptByManagerCents,
        houseProfitCents: depositTotalCents - commissionGeneratedCents,
      };
    });

    return { items: statsRows, total };
  }

  async getNetworkAffiliate(managerId: string, affiliateId: string) {
    const affiliate = await this.affiliateService.getByIdAdmin(affiliateId);
    if (affiliate.managerId !== managerId) throw new ForbiddenError();
    return affiliate;
  }

  /** Every number here comes from src/modules/affiliate's Commission table — never Wallet/Ledger, per the "Manager has zero financial visibility" decision. */
  async getDashboard(managerId: string): Promise<ManagerDashboardStats> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [active, pending, total, today, last7d, last30d] = await Promise.all([
      this.affiliateService.listAdmin({ managerId, status: "APPROVED", page: 1, pageSize: 1 }),
      this.affiliateService.listAdmin({ managerId, status: "PENDING", page: 1, pageSize: 1 }),
      this.commissions.sumAmountCents({ managerId }),
      this.commissions.sumAmountCents({ managerId, from: startOfToday }),
      this.commissions.sumAmountCents({ managerId, from: sevenDaysAgo }),
      this.commissions.sumAmountCents({ managerId, from: thirtyDaysAgo }),
    ]);

    return {
      affiliatesActive: active.total,
      affiliatesPending: pending.total,
      playersReferred: 0, // requires a network-wide referredById count — deferred, see admin/manager network screen for per-affiliate detail instead
      commissionTotalCents: total,
      commissionTodayCents: today,
      commission7dCents: last7d,
      commission30dCents: last30d,
    };
  }

  /**
   * "Links e Convites" — the two-link model (see AGENTS.md's "Refinamento
   * Fase 8"). Both URLs always point at the player zone (zoneUrl("player")),
   * regardless of which host the Manager is browsing from — /r/{code} and
   * /affiliate-invite/{code} only exist in the player-zone route tree (see
   * src/proxy.ts's "Separação de Acessos" host routing).
   */
  async getLinks(managerId: string): Promise<ManagerLinksData> {
    const profile = await this.managers.findById(managerId);
    if (!profile) throw new NotFoundError("Gerente");
    const user = await identityContainer.userManagementService.getById(profile.userId);

    const [platformSignups, directDeposits, network, approvedNetwork] = await Promise.all([
      prisma.user.count({ where: { referredById: profile.userId } }),
      prisma.commission.findMany({
        where: { managerId: profile.id, sourceType: "MANAGER_SPREAD", affiliateId: null },
        distinct: ["originUserId"],
        select: { originUserId: true },
      }),
      this.affiliateService.listAdmin({ managerId: profile.id, page: 1, pageSize: 1 }),
      this.affiliateService.listAdmin({ managerId: profile.id, status: "APPROVED", page: 1, pageSize: 1 }),
    ]);
    const ftd = directDeposits.length;

    return {
      platformLink: {
        url: zoneUrl("player", `/r/${user.referralCode}`),
        clicks: profile.platformLinkClicks,
        signups: platformSignups,
        ftd,
        conversionPercent: platformSignups > 0 ? Math.round((ftd / platformSignups) * 1000) / 10 : 0,
      },
      inviteLink: {
        url: zoneUrl("player", `/affiliate-invite/${profile.inviteCode}`),
        code: profile.inviteCode,
        clicks: profile.inviteLinkClicks,
        signups: network.total,
        conversionPercent: network.total > 0 ? Math.round((approvedNetwork.total / network.total) * 1000) / 10 : 0,
      },
    };
  }

  /** Delegates to AffiliateService.updateCommission with this manager as the ownership scope — see that method's doc comment for the ceiling rule. */
  async updateNetworkAffiliateCommission(
    managerId: string,
    affiliateId: string,
    percent: number,
    actor: DecisionActor
  ) {
    return this.affiliateService.updateCommission(affiliateId, percent, actor, managerId);
  }

  /** Delegates to AffiliateService.setCanInviteAffiliates with this manager as the ownership scope — see "Painel do Afiliado Integrado"'s sub-affiliate recruitment decision. */
  async updateNetworkAffiliateInvitePermission(
    managerId: string,
    affiliateId: string,
    canInviteAffiliates: boolean,
    actor: DecisionActor
  ) {
    return this.affiliateService.setCanInviteAffiliates(affiliateId, canInviteAffiliates, actor, managerId);
  }
}
