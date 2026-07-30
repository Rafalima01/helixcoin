import type { Role } from "@prisma/client";
import type { IUserRepository } from "@/modules/identity/interfaces/user-repository.interface";
import type { IUserSessionRepository } from "@/modules/identity/interfaces/session-repository.interface";
import type { RequestMeta } from "@/modules/identity/services/auth.service";
import type { AdminActor } from "@/modules/identity/services/user-management.service";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import type { IDemoAccountRepository } from "@/modules/demo-accounts/interfaces/demo-account-repository.interface";
import type { DemoAccountRow } from "@/modules/demo-accounts/entities/demo-account.entity";
import { generateDemoLogin, generateDemoPassword, demoEmailFor } from "@/modules/demo-accounts/utils/credentials.util";
import { hashPassword } from "@/server/auth/password";
import { revokeFamily } from "@/server/auth/tokens";
import { generateReferralCode } from "@/modules/identity/utils/referral-code.util";
import { AuditService } from "@/server/audit";
import { BusinessRuleError, NotFoundError } from "@/server/errors";

export interface CreateDemoAccountResult {
  id: string;
  login: string;
  password: string;
  balanceCents: number;
}

/**
 * Contas Demo — exclusivamente criadas pelo backoffice (Admin/Super Admin)
 * para influenciadores/parceiros/gravação de conteúdo. Nunca originadas por
 * cadastro público. Mirrors UserManagementService's shape (mutating methods
 * take (input, actor, meta), end with AuditService.record), but owns its own
 * user-creation/balance/deactivation flow since demo accounts have no email,
 * no admin-chosen role/status, and a WalletService-backed balance step that
 * regular admin user management doesn't have.
 */
export class DemoAccountService {
  constructor(
    private readonly users: IUserRepository,
    private readonly sessions: IUserSessionRepository,
    private readonly wallets: WalletService,
    private readonly repo: IDemoAccountRepository
  ) {}

  async list(): Promise<DemoAccountRow[]> {
    return this.repo.list();
  }

  async create(
    initialBalanceCents: number,
    actor: AdminActor,
    meta: RequestMeta
  ): Promise<CreateDemoAccountResult> {
    let login = generateDemoLogin();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await this.users.findByUsername(login))) break;
      login = generateDemoLogin();
    }

    const password = generateDemoPassword();
    const passwordHash = await hashPassword(password);

    let referralCode = generateReferralCode("Demo");
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await this.users.findByReferralCode(referralCode))) break;
      referralCode = generateReferralCode("Demo");
    }

    const user = await this.users.create({
      firstName: "Conta",
      lastName: "Demo",
      username: login,
      email: demoEmailFor(login),
      passwordHash,
      referralCode,
      status: "ACTIVE",
      role: "USER",
      isDemo: true,
      // Resolved by the game engine's mode-resolution rule (src/game-engine)
      // into the DEMO difficulty profile — set together with isDemo so a
      // demo account is both financially isolated AND plays the DEMO mode.
      tags: ["demo"],
    });

    if (initialBalanceCents > 0) {
      await this.wallets.adjust({
        amountCents: initialBalanceCents,
        userId: user.id,
        reason: "Criação de conta demo",
        observation: `Saldo inicial definido na criação da conta demo por ${actor.role}`,
        idempotencyKey: `demo-account-create:${user.id}`,
        actor: { actorId: actor.id, actorType: "USER", actorRole: actor.role as Role, ip: meta.ip, userAgent: meta.userAgent },
      });
    }

    await AuditService.record({
      actorId: actor.id,
      actorType: "USER",
      actorRole: actor.role as Role,
      action: "admin.demo_account.create",
      entityType: "User",
      entityId: user.id,
      after: { login: user.username, initialBalanceCents },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { id: user.id, login, password, balanceCents: initialBalanceCents };
  }

  async addBalance(
    userId: string,
    amountCents: number,
    actor: AdminActor,
    meta: RequestMeta
  ): Promise<void> {
    const user = await this.getDemoUserOrThrow(userId);

    await this.wallets.adjust({
      amountCents,
      userId: user.id,
      reason: "Adição de saldo demo",
      observation: `Saldo adicionado via backoffice por ${actor.role}`,
      idempotencyKey: `demo-account-add:${crypto.randomUUID()}`,
      actor: { actorId: actor.id, actorType: "USER", actorRole: actor.role as Role, ip: meta.ip, userAgent: meta.userAgent },
    });
  }

  async zeroBalance(userId: string, actor: AdminActor, meta: RequestMeta): Promise<void> {
    const user = await this.getDemoUserOrThrow(userId);
    const balances = await this.wallets.getBalance(user.id);
    if (balances.main === 0) return;

    await this.wallets.adjust({
      amountCents: -balances.main,
      userId: user.id,
      reason: "Zerar saldo demo",
      observation: `Saldo zerado via backoffice por ${actor.role}`,
      idempotencyKey: `demo-account-zero:${crypto.randomUUID()}`,
      actor: { actorId: actor.id, actorType: "USER", actorRole: actor.role as Role, ip: meta.ip, userAgent: meta.userAgent },
    });
  }

  async deactivate(userId: string, actor: AdminActor, meta: RequestMeta): Promise<void> {
    const user = await this.getDemoUserOrThrow(userId);
    if (user.status === "BLOCKED") throw new BusinessRuleError("Conta demo já está desativada");

    await this.users.update(user.id, { status: "BLOCKED" });

    const active = await this.sessions.listByUser(user.id);
    for (const s of active) {
      if (s.status === "ACTIVE") {
        await revokeFamily(s.familyId);
        await this.sessions.revoke(s.id, new Date());
      }
    }

    await AuditService.record({
      actorId: actor.id,
      actorType: "USER",
      actorRole: actor.role as Role,
      action: "admin.demo_account.deactivate",
      entityType: "User",
      entityId: user.id,
      before: { status: user.status },
      after: { status: "BLOCKED" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  private async getDemoUserOrThrow(userId: string) {
    const user = await this.users.findById(userId);
    if (!user || !user.isDemo) throw new NotFoundError("Conta Demo");
    return user;
  }
}
