import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { sha256Hex } from "@/server/security";
import { NotFoundError, ConflictError, BusinessRuleError } from "@/server/errors";
import { AuditService } from "@/server/audit";
import { eventBus } from "@/server/events";
import { NotificationService, NOTIFICATION_TYPES } from "@/server/notifications";
import { identityContainer } from "@/modules/identity/container";
import type { UserEntity } from "@/modules/identity/entities/user.entity";
import { MANAGER_EVENTS } from "@/modules/manager/events/manager.events";
import type { IManagerInviteRepository, ManagerInviteListFilter } from "@/modules/manager/interfaces/manager-invite-repository.interface";
import type { IManagerRepository } from "@/modules/manager/interfaces/manager-repository.interface";
import type { ManagerInvite } from "@/modules/manager/entities/manager-invite.entity";
import type { ManagerProfile } from "@/modules/manager/entities/manager.entity";

/** No candidate identity here — the Admin only generates a bare token/link (see "Cadastro de Gerente" decision, ManagerInviteService.accept). */
export interface CreateInviteInput {
  expiresInDays?: number;
}

/** What the candidate submits to redeem the invite (see ManagerInviteService.accept). */
export interface AcceptInviteInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface InviteActor {
  id: string;
  role: Role;
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/** No accents/uppercase/spaces — must satisfy identity's usernameSchema (`^[a-z0-9_]+$`, 3-24 chars). */
function generateUsernameFromName(name: string): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 14) || "manager";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}_${suffix}`;
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * Owns the admin→prospective-manager onboarding invite lifecycle — the ONLY
 * path by which a User becomes a Manager (see AGENTS.md's "Convite de
 * Gerente" decision). The raw token is generated, hashed, and returned to
 * the caller exactly once (create/regenerate) — never persisted, never
 * re-derivable — the same convention as PasswordResetToken/
 * EmailVerificationToken in src/modules/identity.
 */
export class ManagerInviteService {
  constructor(
    private readonly invites: IManagerInviteRepository,
    private readonly managers: IManagerRepository
  ) {}

  async create(input: CreateInviteInput, actor: InviteActor, meta: RequestMeta): Promise<{ invite: ManagerInvite; rawToken: string }> {
    const rawToken = generateToken();
    const tokenHash = sha256Hex(rawToken);
    const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000) : null;

    const invite = await this.invites.create({
      tokenHash,
      expiresAt,
      createdById: actor.id,
    });

    await AuditService.record({
      actorId: actor.id,
      actorType: "ADMIN",
      actorRole: actor.role,
      action: "manager_invite.create",
      entityType: "ManagerInvite",
      entityId: invite.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    eventBus.publish(MANAGER_EVENTS.inviteCreated, { inviteId: invite.id });

    return { invite, rawToken };
  }

  async getByIdAdmin(id: string) {
    const invite = await this.invites.findByIdAdmin(id);
    if (!invite) throw new NotFoundError("Convite");
    return invite;
  }

  async listAdmin(filter: ManagerInviteListFilter) {
    return this.invites.listAdmin(filter);
  }

  /** Public — resolves a raw token from the acceptance page URL. */
  async getPublicByToken(rawToken: string): Promise<ManagerInvite> {
    const invite = await this.invites.findByTokenHash(sha256Hex(rawToken));
    if (!invite) throw new NotFoundError("Convite");
    this.assertRedeemable(invite);
    return invite;
  }

  /**
   * The invited person supplies their own identity (name/email/phone) AND
   * creates their account here — they do NOT become a Manager yet (see
   * AGENTS.md's "Refinamento Fase 8" decision F / "Cadastro de Gerente"
   * correction). The account is born a normal ACTIVE `USER` (able to log in
   * and play like anyone else); the invite moves to approvalStatus
   * PENDING_REVIEW and surfaces in the Admin's Comercial → Gerentes →
   * Solicitações queue, with the submitted identity persisted onto the row
   * for that review. Only `approve()` promotes the role and creates the
   * ManagerProfile.
   */
  async accept(rawToken: string, input: AcceptInviteInput, meta: RequestMeta): Promise<ManagerInvite> {
    const invite = await this.invites.findByTokenHash(sha256Hex(rawToken));
    if (!invite) throw new NotFoundError("Convite");
    this.assertRedeemable(invite);

    let username = generateUsernameFromName(input.name);
    let user: UserEntity | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        user = await identityContainer.userManagementService.create(
          {
            firstName: input.name.split(" ")[0] || input.name,
            lastName: input.name.split(" ").slice(1).join(" ") || input.name,
            username,
            email: input.email,
            password: input.password,
            phone: input.phone ?? undefined,
            role: "USER",
            status: "ACTIVE",
          },
          { id: invite.createdById, role: "ADMIN" },
          meta
        );
        break;
      } catch (err) {
        if (err instanceof ConflictError && attempt < 4) {
          username = generateUsernameFromName(input.name);
          continue;
        }
        throw err;
      }
    }
    if (!user) throw new BusinessRuleError("Não foi possível criar a conta");

    const updated = await this.invites.markAcceptedPendingReview(
      invite.id,
      user.id,
      { name: input.name, email: input.email, phone: input.phone ?? null },
      meta.ip,
      meta.userAgent
    );

    await AuditService.record({
      actorId: user.id,
      actorType: "USER",
      action: "manager_invite.accepted",
      entityType: "ManagerInvite",
      entityId: invite.id,
      after: { userId: user.id, approvalStatus: "PENDING_REVIEW" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    eventBus.publish(MANAGER_EVENTS.inviteAccepted, { inviteId: invite.id, userId: user.id });

    return updated;
  }

  /** The Admin's Solicitações queue — accepted invites awaiting a verdict. */
  async listPendingApprovals(filter: { search?: string; page: number; pageSize: number }) {
    return this.invites.listAdmin({ ...filter, status: "USED", approvalStatus: "PENDING_REVIEW" });
  }

  /**
   * Promotes the account to MANAGER, creates its ManagerProfile with
   * `commissionPercent` as the ceiling decided right now (never at invite
   * creation — see AGENTS.md), and unlocks portal access immediately.
   */
  async approve(inviteId: string, commissionPercent: number, actor: InviteActor, meta: RequestMeta): Promise<ManagerProfile> {
    const invite = await this.invites.findById(inviteId);
    if (!invite) throw new NotFoundError("Convite");
    if (invite.approvalStatus !== "PENDING_REVIEW" || !invite.acceptedByUserId) {
      throw new BusinessRuleError("Este convite não está aguardando aprovação");
    }

    await identityContainer.userManagementService.update(
      invite.acceptedByUserId,
      { role: "MANAGER" },
      { id: actor.id, role: actor.role },
      meta
    );

    let inviteCode = generateInviteCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await this.managers.findByInviteCode(inviteCode))) break;
      inviteCode = generateInviteCode();
    }

    const profile = await this.managers.create({
      userId: invite.acceptedByUserId,
      inviteCode,
      commissionPercent,
      status: "ACTIVE",
      inviteId: invite.id,
    });

    await this.invites.markApproved(inviteId, commissionPercent, actor.id);

    await AuditService.record({
      actorId: actor.id,
      actorType: "ADMIN",
      actorRole: actor.role,
      action: "manager_invite.approve",
      entityType: "ManagerInvite",
      entityId: inviteId,
      after: { userId: invite.acceptedByUserId, commissionPercent },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    eventBus.publish(MANAGER_EVENTS.inviteApproved, { inviteId, userId: invite.acceptedByUserId, commissionPercent });

    await NotificationService.notify({
      userId: invite.acceptedByUserId,
      type: NOTIFICATION_TYPES.accountApproved,
      title: "Cadastro de gerente aprovado",
      message: `Seu cadastro de gerente foi aprovado com comissão máxima de ${commissionPercent}%. Você já pode acessar o painel.`,
    });

    return profile;
  }

  async reject(inviteId: string, reason: string, actor: InviteActor, meta: RequestMeta): Promise<ManagerInvite> {
    const invite = await this.invites.findById(inviteId);
    if (!invite) throw new NotFoundError("Convite");
    if (invite.approvalStatus !== "PENDING_REVIEW" || !invite.acceptedByUserId) {
      throw new BusinessRuleError("Este convite não está aguardando aprovação");
    }

    const updated = await this.invites.markRejected(inviteId, reason, actor.id);

    await AuditService.record({
      actorId: actor.id,
      actorType: "ADMIN",
      actorRole: actor.role,
      action: "manager_invite.reject",
      entityType: "ManagerInvite",
      entityId: inviteId,
      after: { userId: invite.acceptedByUserId, rejectionReason: reason },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    eventBus.publish(MANAGER_EVENTS.inviteRejected, { inviteId, userId: invite.acceptedByUserId, reason });

    await NotificationService.notify({
      userId: invite.acceptedByUserId,
      type: NOTIFICATION_TYPES.system,
      title: "Solicitação de gerente recusada",
      message: `Sua solicitação para se tornar gerente foi recusada. Motivo: ${reason}`,
    });

    return updated;
  }

  async regenerate(id: string, actor: InviteActor, meta: RequestMeta): Promise<{ invite: ManagerInvite; rawToken: string }> {
    const existing = await this.invites.findById(id);
    if (!existing) throw new NotFoundError("Convite");
    if (existing.status === "USED") throw new BusinessRuleError("Convite já utilizado — não pode ser regenerado");

    const rawToken = generateToken();
    const tokenHash = sha256Hex(rawToken);
    const invite = await this.invites.rotateToken(id, tokenHash, existing.expiresAt);

    await AuditService.record({
      actorId: actor.id,
      actorType: "ADMIN",
      actorRole: actor.role,
      action: "manager_invite.regenerate",
      entityType: "ManagerInvite",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    eventBus.publish(MANAGER_EVENTS.inviteRegenerated, { inviteId: id });

    return { invite, rawToken };
  }

  async revoke(id: string, actor: InviteActor, meta: RequestMeta): Promise<ManagerInvite> {
    const existing = await this.invites.findById(id);
    if (!existing) throw new NotFoundError("Convite");
    if (existing.status === "USED") throw new BusinessRuleError("Convite já utilizado — não pode ser revogado");

    const invite = await this.invites.markRevoked(id, actor.id);

    await AuditService.record({
      actorId: actor.id,
      actorType: "ADMIN",
      actorRole: actor.role,
      action: "manager_invite.revoke",
      entityType: "ManagerInvite",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    eventBus.publish(MANAGER_EVENTS.inviteRevoked, { inviteId: id });

    return invite;
  }

  private assertRedeemable(invite: ManagerInvite): void {
    if (invite.status === "USED") throw new BusinessRuleError("Este convite já foi utilizado");
    if (invite.status === "REVOKED") throw new BusinessRuleError("Este convite foi revogado");
    if (invite.status === "EXPIRED" || (invite.expiresAt && invite.expiresAt < new Date())) {
      throw new BusinessRuleError("Este convite expirou");
    }
  }
}
