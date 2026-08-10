import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/server/errors";
import { eventBus } from "@/server/events";
import { AuditService } from "@/server/audit";
import { NotificationService, NOTIFICATION_TYPES } from "@/server/notifications";
import { AFFILIATE_EVENTS } from "@/modules/affiliate/events/affiliate.events";
import type { IAffiliateRepository } from "@/modules/affiliate/interfaces/affiliate-repository.interface";
import type { IAffiliateSettingsRepository } from "@/modules/affiliate/interfaces/affiliate-settings-repository.interface";
import type { IManagerRepository } from "@/modules/manager/interfaces/manager-repository.interface";
import type { AffiliateProfile, AffiliateProfileAdminRow } from "@/modules/affiliate/entities/affiliate.entity";
import type { AffiliateProfileListFilter } from "@/modules/affiliate/interfaces/affiliate-repository.interface";
import { encrypt } from "@/server/security/crypto-utils";

export interface DecisionActor {
  actorId: string;
  actorRole: Role;
  ip?: string | null;
  userAgent?: string | null;
}

export type AffiliateDecisionAction = "APPROVE" | "REJECT" | "BLOCK" | "REQUEST_DOCUMENTS";

/**
 * Owns the "is this User a real, approved, paid affiliate" state machine.
 * Never touches Wallet/Ledger — that's exclusively commission.service.ts's
 * job, gated on the status this service maintains.
 */
export class AffiliateService {
  constructor(
    private readonly affiliates: IAffiliateRepository,
    private readonly settingsRepo: IAffiliateSettingsRepository,
    /**
     * Own instance, not src/modules/manager/container.ts's — that container
     * imports this module's container, so importing it back here would be a
     * cycle. Both instances are stateless Prisma wrappers reading the same
     * table; see AGENTS.md's "Refinamento Fase 8" decision. Optional only so
     * existing tests/call sites that don't touch commission ceilings can
     * omit it; updateCommission() is the sole caller.
     */
    private readonly managers?: IManagerRepository
  ) {}

  async apply(userId: string, input: { managerCode?: string; pixKey?: string }): Promise<AffiliateProfile> {
    const existing = await this.affiliates.findByUserId(userId);
    if (existing) throw new ConflictError("Você já possui uma solicitação de afiliado");

    let managerId: string | null = null;
    if (input.managerCode) {
      // Direct read, not through src/modules/manager — manager already
      // depends on affiliate (imports affiliateContainer), so resolving the
      // invite code here (instead of the other way around) avoids a cycle.
      const manager = await prisma.managerProfile.findUnique({ where: { inviteCode: input.managerCode } });
      if (manager) managerId = manager.id;
    }

    const affiliate = await this.affiliates.create({
      userId,
      managerId,
      status: "PENDING",
      pixKeyEncrypted: input.pixKey ? encrypt(input.pixKey) : null,
    });

    await NotificationService.notify({
      userId,
      type: NOTIFICATION_TYPES.system,
      title: "Solicitação enviada",
      message: "Sua solicitação para se tornar afiliado foi enviada e está em análise.",
    });
    eventBus.publish(AFFILIATE_EVENTS.created, {
      affiliateId: affiliate.id,
      userId,
      status: affiliate.status,
      managerId: affiliate.managerId,
    });

    return affiliate;
  }

  /**
   * Every player is a real, paid affiliate from the moment they sign up —
   * no request/approval step (see the "Indique e Ganhe" screen). Called
   * best-effort right after registration (auth.controller.ts) AND lazily
   * from handleGetMyAffiliateProfile for any account created before this
   * existed, so opening the tab is always enough to already have a link.
   * Idempotent: returns the existing profile untouched if one is already
   * there, never throws ConflictError like apply() does.
   */
  async autoEnroll(userId: string): Promise<AffiliateProfile> {
    const existing = await this.affiliates.findByUserId(userId);
    if (existing) return existing;

    const affiliate = await this.affiliates.create({ userId, status: "APPROVED" });
    const approved = await this.affiliates.update(affiliate.id, { approvedAt: new Date() });

    eventBus.publish(AFFILIATE_EVENTS.approved, {
      affiliateId: approved.id,
      userId,
      status: approved.status,
      managerId: approved.managerId,
    });

    return approved;
  }

  /**
   * First-touch manager attribution for someone who arrived via a Manager's
   * "Convidar Afiliados" link (/affiliate-invite/[code]/route.ts redirects
   * to /referrals?manager=CODE) — now that there's no apply form to collect
   * the code, the "Indique" tab calls this once on mount instead. A no-op
   * when the code doesn't resolve or the affiliate already has a manager
   * (never overwrites an existing attribution).
   */
  async assignManagerIfUnset(userId: string, managerCode: string): Promise<AffiliateProfile> {
    const affiliate = await this.affiliates.findByUserId(userId);
    if (!affiliate) throw new NotFoundError("Perfil de afiliado");
    if (affiliate.managerId) return affiliate;

    const manager = await prisma.managerProfile.findUnique({ where: { inviteCode: managerCode } });
    if (!manager) return affiliate;

    const updated = await this.affiliates.update(affiliate.id, { managerId: manager.id });
    eventBus.publish(AFFILIATE_EVENTS.managerAssigned, {
      affiliateId: updated.id,
      userId,
      status: updated.status,
      managerId: updated.managerId,
    });
    return updated;
  }

  async getProfile(userId: string): Promise<AffiliateProfile> {
    const profile = await this.affiliates.findByUserId(userId);
    if (!profile) throw new NotFoundError("Perfil de afiliado");
    return profile;
  }

  async getByIdAdmin(id: string): Promise<AffiliateProfileAdminRow> {
    const profile = await this.affiliates.findByIdAdmin(id);
    if (!profile) throw new NotFoundError("Afiliado");
    return profile;
  }

  /** Null (not NotFoundError) when the user has no AffiliateProfile yet — lets the admin Users drawer distinguish "show existing" from "offer Transformar em afiliado" without a try/catch. */
  async getByUserIdAdmin(userId: string): Promise<AffiliateProfileAdminRow | null> {
    return this.affiliates.findByUserIdAdmin(userId);
  }

  /**
   * Admin-triggered equivalent of autoEnroll() (see that method's doc
   * comment) for a User an Admin found via Gestão de Usuários — same
   * creation path (status APPROVED, managerId null i.e. "Direto",
   * revShareOverridePercent null i.e. uses AffiliateSettings' 5% default),
   * just with an actor and an audit trail, since this is a deliberate admin
   * action rather than a silent signup side effect. Idempotent: a user who
   * already has a profile (direct or managed) is returned untouched, never
   * duplicated — mirrors autoEnroll()'s own guard.
   */
  async adminCreateDirect(userId: string, actor: DecisionActor): Promise<AffiliateProfile> {
    const existing = await this.affiliates.findByUserId(userId);
    if (existing) return existing;

    const created = await this.autoEnroll(userId);

    await AuditService.record({
      actorId: actor.actorId,
      actorType: "ADMIN",
      actorRole: actor.actorRole,
      action: "affiliate.admin_create",
      entityType: "AffiliateProfile",
      entityId: created.id,
      before: null,
      after: { userId, status: created.status, managerId: created.managerId },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    return created;
  }

  async listAdmin(filter: AffiliateProfileListFilter) {
    return this.affiliates.listAdmin(filter);
  }

  async assignManager(affiliateId: string, managerId: string | null): Promise<AffiliateProfile> {
    const affiliate = await this.affiliates.findById(affiliateId);
    if (!affiliate) throw new NotFoundError("Afiliado");
    const updated = await this.affiliates.update(affiliateId, { managerId });
    eventBus.publish(AFFILIATE_EVENTS.managerAssigned, {
      affiliateId: updated.id,
      userId: updated.userId,
      status: updated.status,
      managerId: updated.managerId,
    });
    return updated;
  }

  /**
   * `scopeManagerId` is set when the caller is a Manager acting on their own
   * network (see src/modules/manager/services/manager.service.ts) — a
   * Manager can only decide when both (a) the affiliate belongs to them and
   * (b) AffiliateSettings.requireManagerApprovalForAffiliates is on. Admin
   * calls pass `scopeManagerId: undefined` and are never scope-restricted.
   */
  async decide(
    affiliateId: string,
    action: AffiliateDecisionAction,
    reason: string | undefined,
    actor: DecisionActor,
    scopeManagerId?: string
  ): Promise<AffiliateProfile> {
    const affiliate = await this.affiliates.findById(affiliateId);
    if (!affiliate) throw new NotFoundError("Afiliado");

    if (scopeManagerId !== undefined) {
      if (affiliate.managerId !== scopeManagerId) throw new ForbiddenError();
      const settings = await this.settingsRepo.get();
      if (!settings.requireManagerApprovalForAffiliates) throw new ForbiddenError();
    }

    if (affiliate.status === "APPROVED" && action !== "BLOCK") {
      throw new BusinessRuleError("Afiliado já aprovado");
    }

    const now = new Date();
    let updated: AffiliateProfile;
    let notifyTitle: string;
    let notifyMessage: string;
    let eventName: string;

    switch (action) {
      case "APPROVE":
        updated = await this.affiliates.update(affiliateId, {
          status: "APPROVED",
          approvedAt: now,
          approvedById: actor.actorId,
          rejectionReason: null,
        });
        notifyTitle = "Cadastro aprovado";
        notifyMessage = "Seu cadastro de afiliado foi aprovado. Você já pode gerar links e receber comissões.";
        eventName = AFFILIATE_EVENTS.approved;
        break;
      case "REJECT":
        updated = await this.affiliates.update(affiliateId, { status: "REJECTED", rejectionReason: reason ?? null });
        notifyTitle = "Cadastro recusado";
        notifyMessage = `Sua solicitação de afiliado foi recusada. Motivo: ${reason}`;
        eventName = AFFILIATE_EVENTS.rejected;
        break;
      case "BLOCK":
        updated = await this.affiliates.update(affiliateId, {
          status: "BLOCKED",
          blockedAt: now,
          blockedReason: reason ?? null,
        });
        notifyTitle = "Conta bloqueada";
        notifyMessage = `Sua conta de afiliado foi bloqueada. Motivo: ${reason}`;
        eventName = AFFILIATE_EVENTS.blocked;
        break;
      case "REQUEST_DOCUMENTS":
        updated = await this.affiliates.update(affiliateId, { status: "DOCUMENTS_REQUESTED" });
        notifyTitle = "Documentos pendentes";
        notifyMessage = `Envie os documentos solicitados para continuar sua análise. ${reason ?? ""}`.trim();
        eventName = AFFILIATE_EVENTS.documentsRequested;
        break;
    }

    await AuditService.record({
      actorId: actor.actorId,
      // AuditActorType has no MANAGER value — a Manager deciding an
      // application is still a staff/oversight action, same category as ADMIN.
      actorType: "ADMIN",
      actorRole: actor.actorRole,
      action: `affiliate.${action.toLowerCase()}`,
      entityType: "AffiliateProfile",
      entityId: affiliateId,
      before: { status: affiliate.status },
      after: { status: updated.status },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    await NotificationService.notify({
      userId: updated.userId,
      type:
        action === "APPROVE"
          ? NOTIFICATION_TYPES.accountApproved
          : action === "BLOCK"
            ? NOTIFICATION_TYPES.accountBlocked
            : action === "REQUEST_DOCUMENTS"
              ? NOTIFICATION_TYPES.documentsPending
              : NOTIFICATION_TYPES.system,
      title: notifyTitle,
      message: notifyMessage,
    });

    eventBus.publish(eventName, {
      affiliateId: updated.id,
      userId: updated.userId,
      status: updated.status,
      managerId: updated.managerId,
    });

    return updated;
  }

  /** Used by commission.service.ts's tree-walk — a plain existence+status check, no join needed. */
  async findApprovedByUserId(userId: string): Promise<AffiliateProfile | null> {
    const profile = await this.affiliates.findByUserId(userId);
    return profile && profile.status === "APPROVED" ? profile : null;
  }

  /**
   * A Manager sets one of their network affiliates' commission — mandatory
   * rule (see AGENTS.md's "Refinamento Fase 8"): an affiliate can never earn
   * above their manager's ceiling (ManagerProfile.commissionPercent). `percent`
   * is 0-100, same convention as ManagerProfile.commissionPercent/the admin
   * UI — persisted as a 0-1 fraction in `revShareOverridePercent` to match
   * how commission.service.ts's tree-walk consumes it (multiplied directly
   * against deposit cents, same as AffiliateSettings.revShareLevel*Percent).
   * `scopeManagerId` (set when the caller is a Manager acting on their own
   * network) additionally enforces ownership — same pattern as `decide()`.
   */
  async updateCommission(affiliateId: string, percent: number, actor: DecisionActor, scopeManagerId?: string): Promise<AffiliateProfile> {
    const affiliate = await this.affiliates.findById(affiliateId);
    if (!affiliate) throw new NotFoundError("Afiliado");

    if (scopeManagerId !== undefined && affiliate.managerId !== scopeManagerId) {
      throw new ForbiddenError();
    }

    if (affiliate.managerId && this.managers) {
      const manager = await this.managers.findById(affiliate.managerId);
      if (manager && percent > manager.commissionPercent) {
        throw new BusinessRuleError(`A comissão não pode exceder o teto do gerente (${manager.commissionPercent}%)`);
      }
    }

    const before = affiliate.revShareOverridePercent;
    const updated = await this.affiliates.update(affiliateId, { revShareOverridePercent: percent / 100 });

    await AuditService.record({
      actorId: actor.actorId,
      actorType: "ADMIN",
      actorRole: actor.actorRole,
      action: "affiliate.commission.update",
      entityType: "AffiliateProfile",
      entityId: affiliateId,
      before: { revShareOverridePercent: before },
      after: { revShareOverridePercent: updated.revShareOverridePercent },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    return updated;
  }

  /**
   * Grants/revokes an affiliate's ability to surface their manager's
   * "Convidar Afiliados" link in their own panel (see AGENTS.md's "Painel do
   * Afiliado Integrado"). Same ownership pattern as updateCommission —
   * `scopeManagerId` set means a Manager acting on their own network, Admin
   * calls pass it undefined and are never scope-restricted. No ceiling to
   * check here, it's a plain boolean.
   */
  async setCanInviteAffiliates(
    affiliateId: string,
    value: boolean,
    actor: DecisionActor,
    scopeManagerId?: string
  ): Promise<AffiliateProfile> {
    const affiliate = await this.affiliates.findById(affiliateId);
    if (!affiliate) throw new NotFoundError("Afiliado");

    if (scopeManagerId !== undefined && affiliate.managerId !== scopeManagerId) {
      throw new ForbiddenError();
    }

    const updated = await this.affiliates.update(affiliateId, { canInviteAffiliates: value });

    await AuditService.record({
      actorId: actor.actorId,
      actorType: "ADMIN",
      actorRole: actor.actorRole,
      action: "affiliate.invite-permission.update",
      entityType: "AffiliateProfile",
      entityId: affiliateId,
      before: { canInviteAffiliates: affiliate.canInviteAffiliates },
      after: { canInviteAffiliates: updated.canInviteAffiliates },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
    });

    return updated;
  }

  async getSettings() {
    return this.settingsRepo.get();
  }

  async updateSettings(input: Parameters<IAffiliateSettingsRepository["update"]>[0]) {
    return this.settingsRepo.update(input);
  }
}
