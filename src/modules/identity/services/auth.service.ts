import type { IUserRepository } from "@/modules/identity/interfaces/user-repository.interface";
import type { IUserSessionRepository } from "@/modules/identity/interfaces/session-repository.interface";
import type { UserEntity } from "@/modules/identity/entities/user.entity";
import { canAuthenticate, isLocked } from "@/modules/identity/entities/user.entity";
import type { LoginInput, RegisterInput } from "@/modules/identity/dto/auth.dto";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  issueTokenPair,
  rotateRefreshToken,
  revokeSession,
  revokeFamily,
  blacklistAccessToken,
  parseDurationSeconds,
} from "@/server/auth/tokens";
import { verifyRefreshToken, type AccessTokenClaims } from "@/server/auth/jwt";
import { AuditService } from "@/server/audit";
import { eventBus } from "@/server/events";
import { ConflictError, ForbiddenError, UnauthorizedError, BusinessRuleError } from "@/server/errors";
import { createChildLogger } from "@/server/logger";
import { parseUserAgent } from "@/modules/identity/utils/user-agent.util";
import { generateReferralCode } from "@/modules/identity/utils/referral-code.util";
import { IDENTITY_EVENTS } from "@/modules/identity/events/identity.events";
import {
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
  SESSION_TTL_DEFAULT,
  SESSION_TTL_REMEMBER_ME,
  allowConcurrentSessions,
} from "@/modules/identity/constants/identity.constants";

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export interface LoginResult {
  user: UserEntity;
  accessToken: string;
  refreshToken: string;
  sessionId: string; // == familyId — see server/auth/tokens.ts's doc comment on why the durable Session row is keyed by familyId, not the rotating Redis sessionId
}

export class AuthService {
  constructor(
    private readonly users: IUserRepository,
    private readonly sessions: IUserSessionRepository
  ) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<UserEntity> {
    if (await this.users.findByEmail(input.email)) {
      throw new ConflictError("Este email já está cadastrado");
    }
    if (await this.users.findByUsername(input.username)) {
      throw new ConflictError("Este username já está em uso");
    }

    let referredById: string | undefined;
    if (input.referralCode) {
      const referrer = await this.users.findByReferralCode(input.referralCode);
      if (referrer) referredById = referrer.id;
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
      referralCode,
      referredById,
      status: "PENDING",
      role: "USER",
    });

    eventBus.publish(IDENTITY_EVENTS.userRegistered, { userId: user.id }, user.id);
    await AuditService.record({
      actorId: user.id,
      actorType: "USER",
      action: "auth.register",
      entityType: "User",
      entityId: user.id,
      after: { email: user.email, username: user.username },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return user;
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<LoginResult> {
    const logger = createChildLogger({ module: "identity.auth" });
    const user = await this.users.findByEmail(input.email);

    if (!user) {
      await AuditService.record({
        actorType: "SYSTEM",
        action: "auth.login.failed",
        entityType: "User",
        after: { email: input.email, reason: "not_found" },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedError("Email ou senha incorretos");
    }

    if (isLocked(user)) {
      throw new BusinessRuleError(
        `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente após ${user.lockedUntil!.toLocaleTimeString("pt-BR")}.`
      );
    }
    if (!canAuthenticate(user)) {
      throw new ForbiddenError("Esta conta não pode fazer login no momento");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      const attempts = await this.users.incrementLoginAttempts(user.id);
      let lockedNow = false;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const until = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60_000);
        await this.users.setLockedUntil(user.id, until);
        lockedNow = true;
      }
      await AuditService.record({
        actorId: user.id,
        actorType: "USER",
        action: "auth.login.failed",
        entityType: "User",
        entityId: user.id,
        after: { attempts, lockedNow },
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      eventBus.publish(IDENTITY_EVENTS.loginFailed, { userId: user.id }, user.id);
      logger.warn({ userId: user.id, attempts, lockedNow }, "login failed");
      throw new UnauthorizedError("Email ou senha incorretos");
    }

    await this.users.resetLoginAttempts(user.id);
    await this.users.recordLogin(user.id, new Date());

    if (!allowConcurrentSessions()) {
      const revoked = await this.sessions.listByUser(user.id);
      for (const s of revoked) {
        if (s.status === "ACTIVE") {
          await revokeFamily(s.id);
          await this.sessions.revoke(s.id, new Date());
        }
      }
    }

    const refreshTtl = input.rememberMe ? SESSION_TTL_REMEMBER_ME : SESSION_TTL_DEFAULT;
    const tokens = await issueTokenPair(user.id, user.role, undefined, refreshTtl);
    const ua = parseUserAgent(meta.userAgent);

    await this.sessions.create({
      id: tokens.familyId,
      userId: user.id,
      familyId: tokens.familyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      os: ua.os,
      browser: ua.browser,
      device: ua.device,
      rememberMe: !!input.rememberMe,
      expiresAt: new Date(Date.now() + parseDurationSeconds(refreshTtl) * 1000),
    });

    eventBus.publish(IDENTITY_EVENTS.sessionCreated, { userId: user.id, sessionId: tokens.familyId }, user.id);
    eventBus.publish(IDENTITY_EVENTS.loginSuccess, { userId: user.id }, user.id);
    await AuditService.record({
      actorId: user.id,
      actorType: "USER",
      action: "auth.login.success",
      entityType: "User",
      entityId: user.id,
      sessionId: tokens.familyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return {
      user: { ...user, loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      sessionId: tokens.familyId,
    };
  }

  /**
   * Rotates the refresh token (server/auth/tokens's single-use rotation +
   * reuse detection) and touches the durable Session row — `familyId` stays
   * stable across calls, so this never creates a new Session, only bumps
   * `lastActivityAt` on the existing one.
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    let tokens;
    try {
      tokens = await rotateRefreshToken(refreshToken);
    } catch (err) {
      // rotateRefreshToken already revoked the Redis-side family on reuse
      // detection — mirror that onto the durable row so "my sessions" shows
      // it as revoked too, then let the UnauthorizedError propagate.
      if (err instanceof UnauthorizedError) {
        try {
          const claims = await verifyRefreshToken(refreshToken);
          await this.sessions.revoke(claims.familyId, new Date());
        } catch {
          // Token's signature/expiry itself is what failed — nothing to mirror.
        }
      }
      throw err;
    }

    await this.sessions.touch(tokens.familyId, new Date());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, sessionId: tokens.familyId };
  }

  async logout(claims: AccessTokenClaims, meta: RequestMeta): Promise<void> {
    await revokeFamily(claims.familyId);
    await revokeSession(claims.sessionId);
    await blacklistAccessToken(claims);
    await this.sessions.revoke(claims.familyId, new Date());

    eventBus.publish(IDENTITY_EVENTS.logout, { userId: claims.sub }, claims.sub);
    await AuditService.record({
      actorId: claims.sub,
      actorType: "USER",
      actorRole: claims.role ?? null,
      action: "auth.logout",
      entityType: "User",
      entityId: claims.sub,
      sessionId: claims.familyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}
