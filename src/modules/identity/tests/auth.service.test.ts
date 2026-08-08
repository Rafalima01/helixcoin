import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthService } from "@/modules/identity/services/auth.service";
import { InMemoryUserRepository } from "@/modules/identity/repositories/user.in-memory-repository";
import { InMemoryUserSessionRepository } from "@/modules/identity/repositories/session.in-memory-repository";
import { hashPassword } from "@/server/auth/password";
import { UnauthorizedError, ForbiddenError, BusinessRuleError, ConflictError } from "@/server/errors";
import type { RequestMeta } from "@/modules/identity/services/auth.service";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));

vi.mock("@/server/auth/tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/tokens")>();
  return {
    ...actual,
    issueTokenPair: vi.fn(async (_userId: string, _role?: unknown, familyId = "fam_1") => ({
      accessToken: "access.token",
      refreshToken: "refresh.token",
      sessionId: "sess_1",
      familyId,
    })),
    rotateRefreshToken: vi.fn(),
    revokeSession: vi.fn(),
    revokeFamily: vi.fn(),
    blacklistAccessToken: vi.fn(),
  };
});

const meta: RequestMeta = { ip: "127.0.0.1", userAgent: "vitest" };

function buildService() {
  const users = new InMemoryUserRepository();
  const sessions = new InMemoryUserSessionRepository();
  return { service: new AuthService(users, sessions), users, sessions };
}

describe("AuthService.register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a PENDING user with a hashed password, a unique referral code, and an auto-generated username/email", async () => {
    const { service } = buildService();
    const user = await service.register(
      {
        firstName: "Rafael",
        lastName: "Lima",
        phone: "11999990001",
        password: "Sup3rSecret!",
        cpf: "11122233043",
      },
      meta
    );
    expect(user.status).toBe("PENDING");
    expect(user.passwordHash).not.toBe("Sup3rSecret!");
    expect(user.referralCode).toBeTruthy();
    expect(user.phone).toBe("11999990001");
    // Player signup never collects these — see auto-identity.util.ts.
    expect(user.username).toMatch(/^player_[a-z0-9]+$/);
    expect(user.email).toBe(`${user.username}@player.helixcoin.internal`);
  });

  it("rejects a duplicate phone", async () => {
    const { service } = buildService();
    await service.register(
      { firstName: "A", lastName: "B", phone: "11999990002", password: "Sup3rSecret!", cpf: "22233344073" },
      meta
    );
    await expect(
      service.register(
        { firstName: "C", lastName: "D", phone: "11999990002", password: "Sup3rSecret!", cpf: "33344455001" },
        meta
      )
    ).rejects.toThrow(ConflictError);
  });

  it("rejects a duplicate CPF", async () => {
    const { service } = buildService();
    await service.register(
      { firstName: "A", lastName: "B", phone: "11999990003", password: "Sup3rSecret!", cpf: "44455566023" },
      meta
    );
    await expect(
      service.register(
        { firstName: "C", lastName: "D", phone: "11999990004", password: "Sup3rSecret!", cpf: "44455566023" },
        meta
      )
    ).rejects.toThrow(ConflictError);
  });

  it("never attributes referral to a Conta Demo referrer — signup stays organic", async () => {
    const { service, users } = buildService();
    const demoReferrer = await users.create({
      firstName: "Conta",
      lastName: "Demo",
      username: "demo22222",
      email: "demo22222@demo.helixcoin.internal",
      passwordHash: "hash",
      referralCode: "DEMOREF1",
      status: "ACTIVE",
      isDemo: true,
      tags: ["demo"],
    });

    const user = await service.register(
      {
        firstName: "Novo",
        lastName: "Jogador",
        phone: "11999990005",
        password: "Sup3rSecret!",
        cpf: "66677788083",
        referralCode: demoReferrer.referralCode,
      },
      meta
    );

    expect(user.referredById).toBeNull();
  });
});

describe("AuthService.login", () => {
  beforeEach(() => vi.clearAllMocks());

  async function seedActiveUser(users: InMemoryUserRepository) {
    return users.create({
      firstName: "Rafael",
      lastName: "Lima",
      username: "rafa",
      email: "rafa@test.com",
      passwordHash: await hashPassword("correct-password"),
      status: "ACTIVE",
      referralCode: "RAFA1234",
    });
  }

  it("throws UnauthorizedError for an unknown email", async () => {
    const { service } = buildService();
    await expect(service.login({ email: "nobody@test.com", password: "x" }, meta)).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("throws UnauthorizedError for a wrong password and increments loginAttempts", async () => {
    const { service, users } = buildService();
    const user = await seedActiveUser(users);
    await expect(service.login({ email: user.email, password: "wrong" }, meta)).rejects.toThrow(
      UnauthorizedError
    );
    const reloaded = await users.findById(user.id);
    expect(reloaded!.loginAttempts).toBe(1);
  });

  it("locks the account after MAX_LOGIN_ATTEMPTS failures", async () => {
    const { service, users } = buildService();
    const user = await seedActiveUser(users);
    for (let i = 0; i < 5; i++) {
      await expect(service.login({ email: user.email, password: "wrong" }, meta)).rejects.toThrow();
    }
    const reloaded = await users.findById(user.id);
    expect(reloaded!.lockedUntil).not.toBeNull();
    await expect(service.login({ email: user.email, password: "correct-password" }, meta)).rejects.toThrow(
      BusinessRuleError
    );
  });

  it("rejects a BLOCKED user even with the correct password", async () => {
    const { service, users } = buildService();
    const user = await seedActiveUser(users);
    await users.update(user.id, { status: "BLOCKED" });
    await expect(service.login({ email: user.email, password: "correct-password" }, meta)).rejects.toThrow(
      ForbiddenError
    );
  });

  it("succeeds with correct credentials, resets attempts, and creates a session", async () => {
    const { service, users, sessions } = buildService();
    const user = await seedActiveUser(users);
    const result = await service.login({ email: user.email, password: "correct-password" }, meta);

    expect(result.accessToken).toBe("access.token");
    expect(result.sessionId).toBeTruthy();

    const reloaded = await users.findById(user.id);
    expect(reloaded!.loginAttempts).toBe(0);
    expect(reloaded!.lastLoginAt).not.toBeNull();

    const active = await sessions.listByUser(user.id);
    expect(active).toHaveLength(1);
  });

  it("logs in a player by phone number (no '@', starts with a digit) via phone lookup", async () => {
    const { service, users } = buildService();
    const user = await users.create({
      firstName: "Player",
      lastName: "Um",
      username: "player_abc123xyz9",
      email: "player_abc123xyz9@player.helixcoin.internal",
      phone: "11999990009",
      passwordHash: await hashPassword("correct-password"),
      status: "ACTIVE",
      referralCode: "PLAYER001",
    });

    const result = await service.login({ email: "(11) 99999-0009", password: "correct-password" }, meta);
    expect(result.user.id).toBe(user.id);
  });

  it("logs in a Conta Demo by phone number, exactly like a real player (no more username-based login)", async () => {
    const { service, users } = buildService();
    const demoUser = await users.create({
      firstName: "Conta",
      lastName: "Demo",
      username: "demo33333",
      email: "demo33333@demo.helixcoin.internal",
      phone: "21988887777",
      passwordHash: await hashPassword("Lx92@Pm83"),
      status: "ACTIVE",
      referralCode: "DEMOLOG1",
      isDemo: true,
      tags: ["demo"],
    });

    const result = await service.login({ email: "(21) 98888-7777", password: "Lx92@Pm83" }, meta);
    expect(result.user.id).toBe(demoUser.id);
  });

  it("no longer authenticates by bare username — a Conta Demo without its phone can't log in with its internal username", async () => {
    const { service, users } = buildService();
    await users.create({
      firstName: "Conta",
      lastName: "Demo",
      username: "demo33333",
      email: "demo33333@demo.helixcoin.internal",
      passwordHash: await hashPassword("Lx92@Pm83"),
      status: "ACTIVE",
      referralCode: "DEMOLOG2",
      isDemo: true,
      tags: ["demo"],
    });

    await expect(service.login({ email: "demo33333", password: "Lx92@Pm83" }, meta)).rejects.toThrow(UnauthorizedError);
  });
});

describe("AuthService.logout", () => {
  it("revokes the session row for the claims' familyId", async () => {
    const { service, users, sessions } = buildService();
    const user = await seedActiveUser(users);
    await sessions.create({
      id: "fam_1",
      userId: user.id,
      familyId: "fam_1",
      ip: null,
      userAgent: null,
      os: null,
      browser: null,
      device: null,
      rememberMe: false,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await service.logout(
      { sub: user.id, sessionId: "sess_1", familyId: "fam_1", role: "USER" },
      meta
    );

    const session = await sessions.findById("fam_1");
    expect(session!.status).toBe("REVOKED");
  });

  async function seedActiveUser(users: InMemoryUserRepository) {
    return users.create({
      firstName: "Rafael",
      lastName: "Lima",
      username: "rafa",
      email: "rafa@test.com",
      passwordHash: await hashPassword("correct-password"),
      status: "ACTIVE",
      referralCode: "RAFA1234",
    });
  }
});
