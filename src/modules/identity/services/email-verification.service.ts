import { randomBytes } from "node:crypto";
import type { IUserRepository } from "@/modules/identity/interfaces/user-repository.interface";
import type { IEmailVerificationTokenRepository } from "@/modules/identity/interfaces/token-repository.interface";
import type { IMailSender } from "@/modules/identity/interfaces/mail-sender.interface";
import type { ConfirmEmailVerificationInput } from "@/modules/identity/dto/email-verification.dto";
import { sha256Hex } from "@/server/security";
import { AuditService } from "@/server/audit";
import { eventBus } from "@/server/events";
import { ValidationError, NotFoundError, ConflictError } from "@/server/errors";
import { IDENTITY_EVENTS } from "@/modules/identity/events/identity.events";
import { EMAIL_VERIFICATION_TOKEN_TTL_HOURS } from "@/modules/identity/constants/identity.constants";
import type { RequestMeta } from "@/modules/identity/services/auth.service";

export class EmailVerificationService {
  constructor(
    private readonly users: IUserRepository,
    private readonly tokens: IEmailVerificationTokenRepository,
    private readonly mail: IMailSender
  ) {}

  async requestVerification(userId: string, meta: RequestMeta): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError("User");
    if (user.emailVerifiedAt) throw new ConflictError("Email já verificado");

    await this.tokens.invalidateAllForUser(user.id);
    const token = randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 3_600_000);
    await this.tokens.create(user.id, user.email, tokenHash, expiresAt);

    await this.mail.send({
      to: user.email,
      subject: "Confirme seu email — HeliJump",
      body: `Use o token a seguir para confirmar seu email (válido por ${EMAIL_VERIFICATION_TOKEN_TTL_HOURS}h): ${token}`,
    });

    eventBus.publish(IDENTITY_EVENTS.emailVerificationRequested, { userId: user.id }, user.id);
    await AuditService.record({
      actorId: user.id,
      actorType: "USER",
      action: "auth.email.verification_requested",
      entityType: "User",
      entityId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async confirmVerification(input: ConfirmEmailVerificationInput, meta: RequestMeta): Promise<void> {
    const tokenHash = sha256Hex(input.token);
    const stored = await this.tokens.findValidByHash(tokenHash);
    if (!stored) throw new ValidationError("Token inválido ou expirado");

    const user = await this.users.findById(stored.userId);
    if (!user) throw new NotFoundError("User");
    if (user.email !== stored.email) {
      throw new ValidationError("Token não corresponde ao email atual do usuário");
    }

    await this.users.update(stored.userId, { emailVerifiedAt: new Date() });
    await this.tokens.markUsed(stored.id);
    await this.tokens.invalidateAllForUser(stored.userId);

    eventBus.publish(IDENTITY_EVENTS.emailVerified, { userId: stored.userId }, stored.userId);
    await AuditService.record({
      actorId: stored.userId,
      actorType: "USER",
      action: "auth.email.verified",
      entityType: "User",
      entityId: stored.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}
