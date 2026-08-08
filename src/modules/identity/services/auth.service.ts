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
import { generateAutoUsername, autoEmailFor } from "@/modules/identity/utils/auto-identity.util";
import { onlyDigits } from "@/lib/cpf";
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

  /**
   * `affiliateLinkId` is resolved by the CALLER (auth.controller.ts), not
   * here — this service stays interface-only (no direct Prisma access, no
   * cross-module container imports), so cross-module orchestration
   * (Phase 8's slug -> AffiliateLink.id lookup) happens at the HTTP
   * boundary instead. Analytics-only, never used for attribution.
   */
  async register(input: RegisterInput, meta: RequestMeta, affiliateLinkId?: string | null): Promise<UserEntity> {
    if (await this.users.findByPhone(input.phone)) {
      throw new ConflictError("Este telefone já está cadastrado");
    }
    if (await this.users.findByCpf(input.cpf)) {
      throw new ConflictError("Este CPF já está cadastrado");
    }

    let referredById: string | undefined;
    if (input.referralCode) {
      const referrer = await this.users.findByReferralCode(input.referralCode);
      // Demo accounts (src/modules/demo-accounts) never generate a real
      // referral network — a signup through a demo account's code stays
      // organic, exactly as if no code had been provided at all.
      if (referrer && !referrer.isDemo) referredById = referrer.id;
    }

    const passwordHash = await hashPassword(input.password);

    let referralCode = generateReferralCode(input.firstName);
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await this.users.findByReferralCode(referralCode))) break;
      referralCode = generateReferralCode(input.firstName);
    }

    // Player signup no longer collects username/email (phone is the login
    // identifier — see login() below) but both columns are still
    // required+unique, so they're auto-generated and never shown to the
    // player, mirroring demo-accounts' synthetic-email convention.
    let username = generateAutoUsername();
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await this.users.findByUsername(username))) break;
      username = generateAutoUsername();
    }

    const user = await this.users.create({
      firstName: input.firstName,
      lastName: input.lastName,
      username,
      email: autoEmailFor(username),
      phone: input.phone,
      passwordHash,
      cpf: input.cpf,
      referralCode,
      referredById,
      affiliateLinkId: affiliateLinkId ?? null,
      signupSource: input.source ?? null,
      eligibleForFirstDepositBonus: input.source === "demo",
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
    // Two shapes share this one field: a real email (admin/manager staff, or
    // a legacy player), or a phone number (every player, including Contas
    // Demo — see register() above and DemoAccountService.create, phone is
    // the login identifier, username/email are auto-generated and never
    // shown). The player zone's login field masks digits as
    // "(11) 91234-5678" as the player types, so detection can't key off the
    // first character — instead it's just "has an @ or not".
    //
    // There used to be a third shape here: a Conta Demo's bare username
    // (e.g. "demo47291", no "@domain.internal" behind it) looked up via
    // findByUsername. That's gone — Contas Demo are provisioned with a real
    // phone number now (DemoAccountService.create) and authenticate exactly
    // like any other player. A short, admin-generated, pattern-guessable
    // username being a live credential was also a real brute-force surface
    // this removes.
    const identifier = input.email;
    let user: UserEntity | null;
    if (identifier.includes("@")) {
      user = await this.users.findByEmail(identifier);
    } else {
      user = await this.users.findByPhone(onlyDigits(identifier));
    }

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
