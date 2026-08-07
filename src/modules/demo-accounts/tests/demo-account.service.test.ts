import { describe, expect, it, vi, beforeEach } from "vitest";
import { DemoAccountService } from "@/modules/demo-accounts/services/demo-account.service";
import { InMemoryUserRepository } from "@/modules/identity/repositories/user.in-memory-repository";
import { InMemoryUserSessionRepository } from "@/modules/identity/repositories/session.in-memory-repository";
import { InMemoryWalletRepository } from "@/modules/wallet/repositories/wallet.in-memory-repository";
import { WalletService } from "@/modules/wallet/services/wallet.service";
import type { IDemoAccountRepository } from "@/modules/demo-accounts/interfaces/demo-account-repository.interface";
import type { DemoAccountRow } from "@/modules/demo-accounts/entities/demo-account.entity";
import { BusinessRuleError, NotFoundError } from "@/server/errors";
import type { RequestMeta } from "@/modules/identity/services/auth.service";
import type { AdminActor } from "@/modules/identity/services/user-management.service";

vi.mock("@/server/audit", () => ({ AuditService: { record: vi.fn() } }));
vi.mock("@/server/auth/tokens", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/auth/tokens")>();
  return { ...actual, revokeFamily: vi.fn(), blacklistFamilyAccessTokens: vi.fn() };
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

  it("generates a unique login/password pair and flags isDemo + tags:['demo']", async () => {
    const { service, users } = buildService();
    const result = await service.create(10_000, actor, meta);

    expect(result.login).toMatch(/^demo\d{5}$/);
    expect(result.password).toHaveLength(9);
    expect(result.balanceCents).toBe(10_000);

    const stored = await users.findById(result.id);
    expect(stored!.isDemo).toBe(true);
    expect(stored!.tags).toEqual(["demo"]);
    expect(stored!.status).toBe("ACTIVE");
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
