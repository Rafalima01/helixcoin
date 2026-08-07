import { randomBytes } from "node:crypto";
import type { IUserRepository } from "@/modules/identity/interfaces/user-repository.interface";
import type { IUserSessionRepository } from "@/modules/identity/interfaces/session-repository.interface";
import type { IPasswordResetTokenRepository } from "@/modules/identity/interfaces/token-repository.interface";
import type { IMailSender } from "@/modules/identity/interfaces/mail-sender.interface";
import type {
  ChangePasswordInput,
  ConfirmPasswordResetInput,
} from "@/modules/identity/dto/password.dto";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { revokeFamily, blacklistFamilyAccessTokens } from "@/server/auth/tokens";
import { sha256Hex } from "@/server/security";
import { AuditService } from "@/server/audit";
import { eventBus } from "@/server/events";
import { ValidationError, NotFoundError } from "@/server/errors";
import { IDENTITY_EVENTS } from "@/modules/identity/events/identity.events";
import { PASSWORD_RESET_TOKEN_TTL_MINUTES } from "@/modules/identity/constants/identity.constants";
import type { RequestMeta } from "@/modules/identity/services/auth.service";

export class PasswordService {
  constructor(
    private readonly users: IUserRepository,
    private readonly sessions: IUserSessionRepository,
    private readonly resetTokens: IPasswordResetTokenRepository,
    private readonly mail: IMailSender
  ) {}

  async changePassword(userId: string, input: ChangePasswordInput, meta: RequestMeta): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError("User");

    const valid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!valid) throw new ValidationError("Senha atual incorreta");

    const passwordHash = await hashPassword(input.newPassword);
    await this.users.updatePasswordHash(userId, passwordHash);

    if (input.revokeOtherSessions) {
      const active = await this.sessions.listByUser(userId);
      for (const s of active) {
        if (s.status === "ACTIVE") {
          await blacklistFamilyAccessTokens(s.id);
          await revokeFamily(s.id);
          await this.sessions.revoke(s.id, new Date());
        }
      }
    }

    eventBus.publish(IDENTITY_EVENTS.passwordChanged, { userId }, userId);
    await AuditService.record({
      actorId: userId,
      actorType: "USER",
      action: "auth.password.change",
      entityType: "User",
      entityId: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async requestReset(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.users.findByEmail(email);
    // Never reveal whether the email exists — same response either way.
    if (!user) return;

    await this.resetTokens.invalidateAllForUser(user.id);
    const token = randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000);
    await this.resetTokens.create(user.id, tokenHash, expiresAt, meta.ip);

    await this.mail.send({
      to: user.email,
      subject: "Redefinição de senha — HeliJump",
      body: `Use o token a seguir para redefinir sua senha (válido por ${PASSWORD_RESET_TOKEN_TTL_MINUTES} minutos): ${token}`,
    });

    eventBus.publish(IDENTITY_EVENTS.passwordResetRequested, { userId: user.id }, user.id);
    await AuditService.record({
      actorId: user.id,
      actorType: "USER",
      action: "auth.password.reset_requested",
      entityType: "User",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async confirmReset(input: ConfirmPasswordResetInput, meta: RequestMeta): Promise<void> {
    const tokenHash = sha256Hex(input.token);
    const stored = await this.resetTokens.findValidByHash(tokenHash);
    if (!stored) throw new ValidationError("Token inválido ou expirado");

    const passwordHash = await hashPassword(input.newPassword);
    await this.users.updatePasswordHash(stored.userId, passwordHash);
    await this.resetTokens.markUsed(stored.id);
    await this.resetTokens.invalidateAllForUser(stored.userId);

    // A password reset is a strong signal of account recovery — revoke
    // every existing session, no opt-out (unlike a self-service change).
    const active = await this.sessions.listByUser(stored.userId);
    for (const s of active) {
      if (s.status === "ACTIVE") {
        await blacklistFamilyAccessTokens(s.id);
        await revokeFamily(s.id);
        await this.sessions.revoke(s.id, new Date());
      }
    }

    eventBus.publish(IDENTITY_EVENTS.passwordResetCompleted, { userId: stored.userId }, stored.userId);
    await AuditService.record({
      actorId: stored.userId,
      actorType: "USER",
      action: "auth.password.reset_completed",
      entityType: "User",
      entityId: stored.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}
