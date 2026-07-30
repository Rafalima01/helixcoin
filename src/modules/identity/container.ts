import { PrismaUserRepository } from "@/modules/identity/repositories/user.prisma-repository";
import { PrismaUserSessionRepository } from "@/modules/identity/repositories/session.prisma-repository";
import { PrismaPasswordResetTokenRepository } from "@/modules/identity/repositories/password-reset.prisma-repository";
import { PrismaEmailVerificationTokenRepository } from "@/modules/identity/repositories/email-verification.prisma-repository";
import { PrismaPermissionRepository } from "@/modules/identity/repositories/permission.prisma-repository";
import { PrismaMfaMethodRepository } from "@/modules/identity/repositories/mfa.prisma-repository";
import { ConsoleMailSender } from "@/modules/identity/repositories/mail-sender.console";
import { AuthService } from "@/modules/identity/services/auth.service";
import { PasswordService } from "@/modules/identity/services/password.service";
import { EmailVerificationService } from "@/modules/identity/services/email-verification.service";
import { SessionService } from "@/modules/identity/services/session.service";
import { PermissionService } from "@/modules/identity/services/permission.service";
import { UserManagementService } from "@/modules/identity/services/user-management.service";
import { MfaService } from "@/modules/identity/services/mfa.service";
import { LoginHistoryService } from "@/modules/identity/services/login-history.service";

/**
 * Module-scope singletons wiring the identity module's Prisma-backed
 * repositories into its services — the production counterpart to what each
 * service's unit test builds with in-memory repositories instead. Every
 * controller imports from here rather than constructing its own instances,
 * so all controllers share one connection-pooled repository per entity.
 */
const users = new PrismaUserRepository();
const sessions = new PrismaUserSessionRepository();
const passwordResetTokens = new PrismaPasswordResetTokenRepository();
const emailVerificationTokens = new PrismaEmailVerificationTokenRepository();
const permissions = new PrismaPermissionRepository();
const mfaMethods = new PrismaMfaMethodRepository();
const mail = new ConsoleMailSender();

export const identityContainer = {
  authService: new AuthService(users, sessions),
  passwordService: new PasswordService(users, sessions, passwordResetTokens, mail),
  emailVerificationService: new EmailVerificationService(users, emailVerificationTokens, mail),
  sessionService: new SessionService(sessions),
  permissionService: new PermissionService(permissions),
  userManagementService: new UserManagementService(users, sessions),
  mfaService: new MfaService(mfaMethods),
  loginHistoryService: new LoginHistoryService(),
  userRepository: users,
};
