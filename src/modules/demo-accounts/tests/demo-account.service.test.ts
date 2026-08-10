import { describe, expect, it, vi, beforeEach } from "vitest";
import { DemoAccountService } from "@/modules/demo-accounts/services/demo-account.service";
import { AuthService } from "@/modules/identity/services/auth.service";
import { InMemoryUserRepository } from "@/modules/identity/repositories/user.in-memory-repository";
import { InMemoryUserSessionRepository } from "@/modules/identity/repositories/session.in-memory-repository";
import { InMemoryWalletRepository } from "@/modules/wallet/repositories/wallet.in-memory-repository";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import type { IDemoAccountRepository } from "@/modules/demo-accounts/interfaces/demo-account-repository.interface";
import type { DemoAccountRow } from "@/modules/demo-accounts/entities/demo-account.entity";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import type { RequestMeta } from "@/modules/identity/services/auth.service";
import type { AdminActor } from "@/modules/identity/services/user-management.service";
import { isValidBrazilianPhone, formatPhone } from "@/lib/phone";
import { DEMO_ACCOUNT_DEFAULT_PASSWORD } from "@/modules/demo-accounts/utils/credentials.util";
import { UnauthorizedError } from "@/server/errors";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/auth/tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/tokens")>();
  return {
    ...actual,
    revokeFamily: vi.fn(),
    blacklistFamilyAccessTokens: vi.fn(),
    issueTokenPair: vi.fn(async (_userId: string, _role?: unknown, familyId = "fam_demo_login") => ({
      accessToken: "access.token",
      refreshToken: "refresh.token",
      sessionId: "sess_demo_login",
      familyId,
    })),
  };
});

const meta: RequestMeta = { ip: "127.0.0.1", userAgent: "vitest" };
const actor: AdminActor = { id: "admin_1", role: "ADMIN" };

/** list() isn't exercised here — the admin listing is a thin Prisma-only join tested at the integration/browser level, not worth an in-memory dual-implementation. */
class NoopDemoAccountRepository implements IDemoAccountRepository {
  async list(): Promise<DemoAccountRow[]> {
    return [];
  }
}

function buildService() {
  const users = new InMemoryUserRepository();
  const sessions = new InMemoryUserSessionRepository();
  const wallets = new WalletService(new InMemoryWalletRepository());
  const repo = new NoopDemoAccountRepository();
  return { service: new DemoAccountService(users, sessions, wallets, repo), users, sessions, wallets };
}

describe("DemoAccountService.create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates a unique login and flags isDemo + tags:['demo']", async () => {
    const { service, users } = buildService();
    const result = await service.create(10_000, actor, meta);

    expect(result.login).toMatch(/^demo\d{5}$/);
    expect(result.balanceCents).toBe(10_000);

    const stored = await users.findById(result.id);
    expect(stored!.isDemo).toBe(true);
    expect(stored!.tags).toEqual(["demo"]);
    expect(stored!.status).toBe("ACTIVE");
  });

  it("SENHA PADRÃO — every new Conta Demo receives the fixed demo@123 password, never a random one", async () => {
    const { service } = buildService();
    const first = await service.create(0, actor, meta);
    const second = await service.create(0, actor, meta);
    const third = await service.create(0, actor, meta);

    expect(first.password).toBe("demo@123");
    expect(second.password).toBe("demo@123");
    expect(third.password).toBe("demo@123");
    expect(DEMO_ACCOUNT_DEFAULT_PASSWORD).toBe("demo@123");
  });

  it("SENHA PADRÃO — the password is stored hashed, never as plaintext", async () => {
    const { service, users } = buildService();
    const result = await service.create(0, actor, meta);

    const stored = await users.findById(result.id);
    expect(stored!.passwordHash).not.toBe("demo@123");
    expect(stored!.passwordHash.startsWith("$2")).toBe(true); // bcrypt hash format
  });

  it("generates a real, unique phone and persists it on the user — the login identifier, not the internal username", async () => {
    const { service, users } = buildService();
    const result = await service.create(10_000, actor, meta);

    expect(result.phone).toMatch(/^\d{11}$/);
    expect(isValidBrazilianPhone(result.phone)).toBe(true);

    const stored = await users.findById(result.id);
    expect(stored!.phone).toBe(result.phone);
  });

  it("never collides two Contas Demo on the same phone", async () => {
    const { service } = buildService();
    const first = await service.create(0, actor, meta);
    const second = await service.create(0, actor, meta);
    expect(first.phone).not.toBe(second.phone);
  });

  it("the created Conta Demo can log in immediately with phone+senha, exactly like a real player", async () => {
    const { service, users, sessions } = buildService();
    const created = await service.create(10_000, actor, meta);

    const auth = new AuthService(users, sessions);
    const result = await auth.login({ email: formatPhone(created.phone), password: created.password }, meta);

    expect(result.user.id).toBe(created.id);
  });

  it("SEGURANÇA — sharing demo@123 across every Conta Demo never grants cross-account access: phone A + demo@123 only ever logs into A", async () => {
    const { service, users, sessions } = buildService();
    const accountA = await service.create(0, actor, meta);
    const accountB = await service.create(0, actor, meta);
    expect(accountA.phone).not.toBe(accountB.phone);

    const auth = new AuthService(users, sessions);
    const loginA = await auth.login({ email: formatPhone(accountA.phone), password: DEMO_ACCOUNT_DEFAULT_PASSWORD }, meta);
    const loginB = await auth.login({ email: formatPhone(accountB.phone), password: DEMO_ACCOUNT_DEFAULT_PASSWORD }, meta);

    expect(loginA.user.id).toBe(accountA.id);
    expect(loginB.user.id).toBe(accountB.id);
    expect(loginA.user.id).not.toBe(loginB.user.id);
  });

  it("SEGURANÇA — demo@123 alone, with no phone/identifier, cannot authenticate (login always requires número + senha)", async () => {
    const { service, users, sessions } = buildService();
    await service.create(0, actor, meta);

    const auth = new AuthService(users, sessions);
    // No such identifier "demo@123" exists as a phone or email — login must
    // still resolve a specific user by identifier first, so this rejects
    // exactly like any bogus login, never falling back to "match by password".
    await expect(auth.login({ email: "demo@123", password: DEMO_ACCOUNT_DEFAULT_PASSWORD }, meta)).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("SEGURANÇA — real player accounts keep their own distinct password, untouched by the demo default", async () => {
    const { service, users, sessions } = buildService();
    const demo = await service.create(0, actor, meta);

    const realPasswordHash = await (await import("@/server/auth/password")).hashPassword("MinhaSenhaReal!23");
    const real = await users.create({
      firstName: "Jogador",
      lastName: "Real",
      username: "jogador_real",
      email: "jogador.real@test.com",
      phone: "11988887777",
      passwordHash: realPasswordHash,
      referralCode: "REALPLR1",
      status: "ACTIVE",
    });

    const auth = new AuthService(users, sessions);
    // The real account's own password still works.
    const loginReal = await auth.login({ email: formatPhone("11988887777"), password: "MinhaSenhaReal!23" }, meta);
    expect(loginReal.user.id).toBe(real.id);
    // The demo default password does NOT work against the real account.
    await expect(
      auth.login({ email: formatPhone("11988887777"), password: DEMO_ACCOUNT_DEFAULT_PASSWORD }, meta)
    ).rejects.toThrow(UnauthorizedError);
    // And the demo account is unaffected — still logs in with its own (fixed) password.
    const loginDemo = await auth.login({ email: formatPhone(demo.phone), password: DEMO_ACCOUNT_DEFAULT_PASSWORD }, meta);
    expect(loginDemo.user.id).toBe(demo.id);
  });

  it("the internal username (e.g. demoXXXXX) is never a valid login credential — only phone+senha works", async () => {
    const { service, users, sessions } = buildService();
    const created = await service.create(0, actor, meta);

    const auth = new AuthService(users, sessions);
    await expect(
      auth.login({ email: created.login, password: DEMO_ACCOUNT_DEFAULT_PASSWORD }, meta)
    ).rejects.toThrow(UnauthorizedError);
  });

  it("credits the initial balance via WalletService", async () => {
    const { service, wallets } = buildService();
    const result = await service.create(15_000, actor, meta);
    const balance = await wallets.getBalance(result.id);
    expect(balance.main).toBe(15_000);
  });

  it("creates a zero-balance account without touching the wallet when initialBalanceCents is 0", async () => {
    const { service, wallets } = buildService();
    const result = await service.create(0, actor, meta);
    const balance = await wallets.getBalance(result.id);
    expect(balance.main).toBe(0);
  });
});

describe("DemoAccountService.addBalance / zeroBalance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds balance to an existing Conta Demo", async () => {
    const { service, wallets } = buildService();
    const created = await service.create(10_000, actor, meta);
    await service.addBalance(created.id, 5_000, actor, meta);
    const balance = await wallets.getBalance(created.id);
    expect(balance.main).toBe(15_000);
  });

  it("zeroes the balance of a Conta Demo", async () => {
    const { service, wallets } = buildService();
    const created = await service.create(10_000, actor, meta);
    await service.zeroBalance(created.id, actor, meta);
    const balance = await wallets.getBalance(created.id);
    expect(balance.main).toBe(0);
  });

  it("throws NotFoundError when the target user isn't a Conta Demo", async () => {
    const { service, users } = buildService();
    const regular = await users.create({
      firstName: "Regular",
      lastName: "User",
      username: "regular2",
      email: "regular2@test.com",
      passwordHash: "hash",
      referralCode: "REG2222",
      status: "ACTIVE",
    });
    await expect(service.addBalance(regular.id, 1_000, actor, meta)).rejects.toThrow(NotFoundError);
  });
});

describe("DemoAccountService.deactivate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks the account and revokes active sessions", async () => {
    const { service, users, sessions } = buildService();
    const created = await service.create(10_000, actor, meta);
    await sessions.create({
      id: "fam_demo_1",
      userId: created.id,
      familyId: "fam_demo_1",
      ip: null,
      userAgent: null,
      os: null,
      browser: null,
      device: null,
      rememberMe: false,
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    await service.deactivate(created.id, actor, meta);

    expect((await users.findById(created.id))!.status).toBe("BLOCKED");
    expect((await sessions.findById("fam_demo_1"))!.status).toBe("REVOKED");
  });

  it("rejects deactivating an already-deactivated Conta Demo", async () => {
    const { service } = buildService();
    const created = await service.create(10_000, actor, meta);
    await service.deactivate(created.id, actor, meta);
    await expect(service.deactivate(created.id, actor, meta)).rejects.toThrow(BusinessRuleError);
  });
});
