import type { IUserRepository } from "@/modules/identity/interfaces/user-repository.interface";
import type { IUserSessionRepository } from "@/modules/identity/interfaces/session-repository.interface";
import type { UserEntity } from "@/modules/identity/entities/user.entity";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserSearchQuery,
} from "@/modules/identity/dto/user.dto";
import { hashPassword } from "@/server/auth/password";
import { revokeFamily } from "@/server/auth/tokens";
import { generateReferralCode } from "@/modules/identity/utils/referral-code.util";
import { AuditService } from "@/server/audit";
import { eventBus } from "@/server/events";
import { ConflictError, NotFoundError, BusinessRuleError } from "@/server/errors";
import { IDENTITY_EVENTS } from "@/modules/identity/events/identity.events";
import type { RequestMeta } from "@/modules/identity/services/auth.service";

export interface AdminActor {
  id: string;
  role: string;
}

export class UserManagementService {
  constructor(
    private readonly users: IUserRepository,
    private readonly sessions: IUserSessionRepository
  ) {}

  async search(query: UserSearchQuery) {
    return this.users.search(query);
  }

  async getById(id: string): Promise<UserEntity> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError("User");
    return user;
  }

  async create(input: CreateUserInput, actor: AdminActor, meta: RequestMeta): Promise<UserEntity> {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError("Este email já está cadastrado");
    }
    if (await this.users.findByUsername(input.username)) {
      throw new ConflictError("Este username já está em uso");
    }

    const passwordHash = await hashPassword(input.password);
    let referralCode = generateReferralCode(input.firstName);
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await this.users.findByReferralCode(referralCode))) break;
      referralCode = generateReferralCode(input.firstName);
    }

    const user = await this.users.create({
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      email: input.email,
      passwordHash,
      phone: input.phone,
      role: input.role,
      status: input.status,
      referralCode,
    });

    eventBus.publish(IDENTITY_EVENTS.userRegistered, { userId: user.id }, user.id);
    await AuditService.record({
      actorId: actor.id,
      actorType: "USER",
      action: "admin.user.create",
      entityType: "User",
      entityId: user.id,
      after: { email: user.email, username: user.username, role: user.role, status: user.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return user;
  }

  async update(id: string, input: UpdateUserInput, actor: AdminActor, meta: RequestMeta): Promise<UserEntity> {
    const before = await this.getById(id);

    if (input.email && input.email !== before.email) {
      const existing = await this.users.findByEmail(input.email);
      if (existing) throw new ConflictError("Este email já está cadastrado");
    }
    if (input.username && input.username !== before.username) {
      const existing = await this.users.findByUsername(input.username);
      if (existing) throw new ConflictError("Este username já está em uso");
    }

    const after = await this.users.update(id, {
      ...input,
      dateOfBirth:
        input.dateOfBirth === undefined ? undefined : input.dateOfBirth ? new Date(input.dateOfBirth) : null,
    });

    await AuditService.record({
      actorId: actor.id,
      actorType: "USER",
      action: "admin.user.update",
      entityType: "User",
      entityId: id,
      before: diffFields(before, input),
      after: input,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return after;
  }

  async block(id: string, actor: AdminActor, meta: RequestMeta, reason?: string): Promise<void> {
    const user = await this.getById(id);
    if (user.status === "BLOCKED") throw new BusinessRuleError("Usuário já está bloqueado");

    await this.users.update(id, { status: "BLOCKED" });

    const active = await this.sessions.listByUser(id);
    for (const s of active) {
      if (s.status === "ACTIVE") {
        await revokeFamily(s.familyId);
        await this.sessions.revoke(s.id, new Date());
      }
    }

    eventBus.publish(IDENTITY_EVENTS.userBlocked, { userId: id }, id);
    await AuditService.record({
      actorId: actor.id,
      actorType: "USER",
      action: "admin.user.block",
      entityType: "User",
      entityId: id,
      before: { status: user.status },
      after: { status: "BLOCKED", reason: reason ?? null },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async unblock(id: string, actor: AdminActor, meta: RequestMeta): Promise<void> {
    const user = await this.getById(id);
    if (user.status !== "BLOCKED") throw new BusinessRuleError("Usuário não está bloqueado");

    await this.users.update(id, { status: "ACTIVE" });

    eventBus.publish(IDENTITY_EVENTS.userUnblocked, { userId: id }, id);
    await AuditService.record({
      actorId: actor.id,
      actorType: "USER",
      action: "admin.user.unblock",
      entityType: "User",
      entityId: id,
      before: { status: user.status },
      after: { status: "ACTIVE" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async softDelete(id: string, actor: AdminActor, meta: RequestMeta): Promise<void> {
    const user = await this.getById(id);
    if (user.deletedAt) throw new BusinessRuleError("Usuário já removido");

    await this.users.softDelete(id);

    const active = await this.sessions.listByUser(id);
    for (const s of active) {
      if (s.status === "ACTIVE") {
        await revokeFamily(s.familyId);
        await this.sessions.revoke(s.id, new Date());
      }
    }

    eventBus.publish(IDENTITY_EVENTS.userSoftDeleted, { userId: id }, id);
    await AuditService.record({
      actorId: actor.id,
      actorType: "USER",
      action: "admin.user.soft_delete",
      entityType: "User",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async restore(id: string, actor: AdminActor, meta: RequestMeta): Promise<void> {
    const user = await this.getById(id);
    if (!user.deletedAt) throw new BusinessRuleError("Usuário não está removido");

    await this.users.restore(id);

    eventBus.publish(IDENTITY_EVENTS.userRestored, { userId: id }, id);
    await AuditService.record({
      actorId: actor.id,
      actorType: "USER",
      action: "admin.user.restore",
      entityType: "User",
      entityId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}

/** Narrows `before` down to just the fields present in the update input, so the audit "before" snapshot lines up 1:1 with "after". */
function diffFields<T extends object>(before: T, input: Partial<Record<keyof T, unknown>>): Partial<T> {
  const snapshot: Partial<T> = {};
  for (const key of Object.keys(input) as (keyof T)[]) {
    snapshot[key] = before[key];
  }
  return snapshot;
}
